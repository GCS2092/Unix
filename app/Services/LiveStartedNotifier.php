<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Notifications\LiveInvitationNotification;
use App\Notifications\LiveStartedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class LiveStartedNotifier
{
    /**
     * Previent les inscrits au cours et les personnes deja invitees. Ne leve jamais d'exception :
     * le demarrage du direct ne doit pas echouer a cause des notifications.
     */
    public static function send(Course $course, ?int $exceptUserId = null): void
    {
        try {
            $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
            $token = $course->invite_token;

            $enrolledIds = Enrollment::query()
                ->where('course_id', $course->id)
                ->pluck('user_id')
                ->map(fn ($id) => (int) $id);

            $invitedIds = DB::table('notifications')
                ->where('type', LiveInvitationNotification::class)
                ->where('notifiable_type', User::class)
                ->where('data', 'like', '%"course_id":'.$course->id.',%')
                ->pluck('notifiable_id')
                ->map(fn ($id) => (int) $id);

            $ids = $enrolledIds->merge($invitedIds)
                ->unique()
                ->reject(fn ($id) => $id === $exceptUserId)
                ->take(500)
                ->values();

            if ($ids->isEmpty()) {
                return;
            }

            $enrolledSet = $enrolledIds->flip();

            User::query()
                ->whereIn('id', $ids)
                ->where('is_admin', false)
                ->get()
                ->each(function (User $user) use ($course, $base, $token, $enrolledSet): void {
                    $path = $enrolledSet->has($user->id)
                        ? '/etudiant/direct/'.$course->id
                        : ($token ? '/rejoindre/'.$token : null);

                    if ($path === null) {
                        return;
                    }

                    try {
                        $user->notify(new LiveStartedNotification($course->id, (string) $course->title, $path, $base.$path));
                    } catch (\Throwable $e) {
                        Log::warning('Notification demarrage direct echouee (user '.$user->id.') : '.$e->getMessage());
                    }
                });
        } catch (\Throwable $e) {
            Log::warning('Notification demarrage direct echouee : '.$e->getMessage());
        }
    }
}