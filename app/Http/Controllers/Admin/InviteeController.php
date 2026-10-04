<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Notifications\LiveInvitationNotification;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class InviteeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'course_id' => ['nullable', 'integer', 'exists:courses,id'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $query = User::query()->where('is_student', true)->where('is_admin', false);

        if (! empty($data['course_id'])) {
            $query->whereIn('id', Enrollment::query()->where('course_id', $data['course_id'])->select('user_id'));
        }

        if (! empty($data['q'])) {
            $like = '%'.addcslashes($data['q'], '%_\\').'%';
            $query->where(function ($w) use ($like): void {
                $w->where('name', 'like', $like)->orWhere('email', 'like', $like);
            });
        }

        $users = $query->orderBy('name')->limit(200)->get(['id', 'name', 'email']);

        $titles = Course::query()->pluck('title', 'id');
        $byUser = Enrollment::query()
            ->whereIn('user_id', $users->pluck('id'))
            ->get(['user_id', 'course_id'])
            ->groupBy('user_id');

        $items = $users->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'courses' => collect($byUser->get($u->id, []))
                ->map(fn ($e) => ['id' => (int) $e->course_id, 'title' => (string) ($titles[$e->course_id] ?? '')])
                ->values(),
        ])->values();

        return response()->json(['data' => $items]);
    }

    public function send(Request $request, int $course, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'user_ids' => ['sometimes', 'array', 'max:100'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'extra_emails' => ['sometimes', 'array', 'max:50'],
            'extra_emails.*' => ['email', 'max:190'],
            'message' => ['nullable', 'string', 'max:500'],
        ]);

        $userIds = $data['user_ids'] ?? [];
        $extra = array_values(array_unique(array_map('strtolower', $data['extra_emails'] ?? [])));

        if ($userIds === [] && $extra === []) {
            return response()->json(['message' => 'Sélectionnez au moins un destinataire.'], 422);
        }

        if (count($userIds) + count($extra) > 100) {
            return response()->json(['message' => 'Maximum 100 destinataires par envoi.'], 422);
        }

        $model = Course::query()->findOrFail($course);

        if ($model->invite_token === null) {
            $model->forceFill(['invite_token' => Str::random(40)])->save();
        }

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $guestPath = '/rejoindre/'.$model->invite_token;
        $directPath = '/etudiant/direct/'.$model->id;
        $note = $data['message'] ?? null;
        $sender = (string) $request->user()->name;

        $enrolled = Enrollment::query()->where('course_id', $model->id)->pluck('user_id')->flip();
        $mailReady = LiveInvitationNotification::mailReady();

        $sent = 0;
        $failed = 0;
        $skipped = 0;

        foreach (User::query()->whereIn('id', $userIds)->get() as $user) {
            $isEnrolled = $enrolled->has($user->id);
            $path = $isEnrolled ? $directPath : $guestPath;

            try {
                $user->notify(new LiveInvitationNotification(
                    $model->id,
                    (string) $model->title,
                    $path,
                    $base.$path,
                    ! $isEnrolled,
                    $note,
                    $sender,
                ));
                $sent++;
            } catch (\Throwable $e) {
                Log::warning('Invitation live échouée (user '.$user->id.') : '.$e->getMessage());
                $failed++;
            }
        }

        foreach ($extra as $email) {
            // Sans compte : seul l'e-mail est possible. S'il n'est pas configure, on ne fait pas semblant.
            if (! $mailReady) {
                $skipped++;
                continue;
            }

            try {
                Notification::route('mail', $email)->notify(new LiveInvitationNotification(
                    $model->id,
                    (string) $model->title,
                    $guestPath,
                    $base.$guestPath,
                    true,
                    $note,
                    $sender,
                ));
                $sent++;
            } catch (\Throwable $e) {
                Log::warning('Invitation live échouée ('.$email.') : '.$e->getMessage());
                $failed++;
            }
        }

        $activity->log($request->user(), 'live.invited', $model, ['sent' => $sent, 'failed' => $failed, 'skipped' => $skipped]);

        return response()->json(['data' => [
            'sent' => $sent,
            'failed' => $failed,
            'skipped' => $skipped,
            'mail_ready' => $mailReady,
        ]]);
    }
}