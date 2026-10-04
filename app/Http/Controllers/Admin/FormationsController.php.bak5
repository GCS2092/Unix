<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FormationsController extends Controller
{
    private function completed($query)
    {
        return $query->where(function ($w): void {
            $w->where('progress', '>=', 100)->orWhereNotNull('completed_at');
        });
    }

    private function change(int $cur, int $prev): ?float
    {
        if ($prev === 0) {
            return $cur === 0 ? 0.0 : null;
        }

        return round((($cur - $prev) / $prev) * 100, 1);
    }

    /** @return array{value:int, previous:int, change:?float} */
    private function metric(int $cur, int $prev): array
    {
        return ['value' => $cur, 'previous' => $prev, 'change' => $this->change($cur, $prev)];
    }

    public function dashboard(): JsonResponse
    {
        $now = now();
        $from = $now->copy()->subDays(30);
        $prev = $now->copy()->subDays(60);

        $total = Enrollment::query()->count();
        $completed = $this->completed(Enrollment::query())->count();
        $inProgress = max(0, $total - $completed);
        $avg = (int) round((float) (Enrollment::query()->avg('progress') ?? 0));

        $studentsTotal = User::query()->where('is_student', true)->count();
        $withoutCourse = User::query()->where('is_student', true)->whereDoesntHave('enrollments')->count();
        $active30 = Enrollment::query()->where('updated_at', '>=', $from)->distinct()->count('user_id');

        $coursesTotal = Course::query()->count();
        $coursesPublished = Course::query()->where('is_published', true)->count();
        $coursesLive = Course::query()->whereNotNull('livekit_room')->where('livekit_room', '!=', '')->count();

        $stalledBase = Enrollment::query()
            ->whereNull('completed_at')
            ->where('progress', '<', 100)
            ->where('updated_at', '<', $now->copy()->subDays(14));

        $stalled = (clone $stalledBase)
            ->with(['user:id,name,email', 'course:id,title'])
            ->orderBy('updated_at')
            ->limit(8)
            ->get()
            ->map(fn (Enrollment $e) => [
                'id' => $e->id,
                'user_name' => $e->user?->name,
                'user_email' => $e->user?->email,
                'course_title' => $e->course?->title,
                'progress' => (int) $e->progress,
                'last_activity' => $e->updated_at?->toIso8601String(),
            ])->values();

        $toEnroll = User::query()
            ->where('is_student', true)
            ->whereDoesntHave('enrollments')
            ->orderByDesc('id')
            ->limit(8)
            ->get(['id', 'name', 'email'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'email' => $u->email])
            ->values();

        $top = Course::query()
            ->withCount([
                'enrollments',
                'enrollments as completed_count' => function ($q): void {
                    $q->where(function ($w): void {
                        $w->where('progress', '>=', 100)->orWhereNotNull('completed_at');
                    });
                },
            ])
            ->withAvg('enrollments', 'progress')
            ->orderByDesc('enrollments_count')
            ->orderBy('title')
            ->limit(8)
            ->get()
            ->map(fn (Course $c) => [
                'id' => $c->id,
                'title' => $c->title,
                'is_published' => (bool) $c->is_published,
                'enrollments' => (int) $c->enrollments_count,
                'completed' => (int) $c->completed_count,
                'avg_progress' => (int) round((float) ($c->enrollments_avg_progress ?? 0)),
            ])->values();

        $recent = Enrollment::query()
            ->with(['user:id,name,email', 'course:id,title'])
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(fn (Enrollment $e) => [
                'id' => $e->id,
                'user_name' => $e->user?->name,
                'user_email' => $e->user?->email,
                'course_title' => $e->course?->title,
                'progress' => (int) $e->progress,
                'completed' => $e->isCompleted(),
                'created_at' => $e->created_at?->toIso8601String(),
            ])->values();

        return response()->json(['data' => [
            'summary' => [
                'students_total' => $studentsTotal,
                'students_without_course' => $withoutCourse,
                'active_students_30d' => $active30,
                'courses_total' => $coursesTotal,
                'courses_published' => $coursesPublished,
                'courses_live' => $coursesLive,
                'enrollments_total' => $total,
                'in_progress' => $inProgress,
                'completed' => $completed,
                'completion_rate' => $total > 0 ? (int) round(($completed / $total) * 100) : 0,
                'avg_progress' => $avg,
                'certificates_total' => Certificate::query()->count(),
            ],
            'period' => [
                'enrollments' => $this->metric(
                    Enrollment::query()->where('created_at', '>=', $from)->count(),
                    Enrollment::query()->where('created_at', '>=', $prev)->where('created_at', '<', $from)->count(),
                ),
                'completed' => $this->metric(
                    Enrollment::query()->where('completed_at', '>=', $from)->count(),
                    Enrollment::query()->where('completed_at', '>=', $prev)->where('completed_at', '<', $from)->count(),
                ),
                'certificates' => $this->metric(
                    Certificate::query()->where('issued_at', '>=', $from)->count(),
                    Certificate::query()->where('issued_at', '>=', $prev)->where('issued_at', '<', $from)->count(),
                ),
            ],
            'stalled_count' => (clone $stalledBase)->count(),
            'stalled' => $stalled,
            'to_enroll' => $toEnroll,
            'top_courses' => $top,
            'recent' => $recent,
        ]]);
    }

    /**
     * Cree un compte etudiant, ou relie un compte client existant (meme e-mail).
     */
    public function storeStudent(Request $request, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'course_id' => ['nullable', 'integer', 'exists:courses,id'],
        ]);

        $email = Str::lower(trim($data['email']));
        $user = User::query()->whereRaw('lower(email) = ?', [$email])->first();
        $created = false;
        $mailSent = false;

        if ($user === null) {
            if (blank($data['name'] ?? null)) {
                throw ValidationException::withMessages([
                    'name' => ["Le nom est obligatoire pour cr\u{e9}er un nouveau compte."],
                ]);
            }

            $user = new User([
                'name' => trim($data['name']),
                'email' => $email,
                'phone' => $data['phone'] ?? null,
                'password' => Str::random(40),
            ]);
            $user->is_student = true;
            $user->save();
            $created = true;

            try {
                $mailSent = Password::sendResetLink(['email' => $user->email]) === Password::RESET_LINK_SENT;
            } catch (\Throwable) {
                $mailSent = false;
            }

            $activity->log($request->user(), 'student.created', $user, ['email' => $user->email]);
        } else {
            if ($user->is_blocked) {
                throw ValidationException::withMessages([
                    'email' => ["Ce compte est bloqu\u{e9} : d\u{e9}bloquez-le d'abord."],
                ]);
            }
            if (! $user->is_student) {
                $user->is_student = true;
                $user->save();
                $activity->log($request->user(), 'user.student_enabled', $user, ['email' => $user->email]);
            }
        }

        $enrolled = false;
        if (! empty($data['course_id'])) {
            $enrollment = Enrollment::query()->firstOrCreate(
                ['user_id' => $user->id, 'course_id' => (int) $data['course_id']],
                ['progress' => 0],
            );
            $enrolled = true;
            if ($enrollment->wasRecentlyCreated) {
                $activity->log($request->user(), 'enrollment.created', $enrollment, [
                    'user_id' => $user->id,
                    'course_id' => $enrollment->course_id,
                ]);
            }
        }

        return response()->json([
            'data' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            'created' => $created,
            'mail_sent' => $mailSent,
            'orders_count' => $user->orders()->count(),
            'enrolled' => $enrolled,
        ], $created ? 201 : 200);
    }

    /**
     * Inscrit une personne a un cours (et lui donne l'acces etudiant si besoin).
     */
    public function enroll(Request $request, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'course_id' => ['required', 'integer', 'exists:courses,id'],
        ]);

        $user = User::query()->findOrFail($data['user_id']);

        if ($user->is_blocked) {
            return response()->json(['message' => "Ce compte est bloqu\u{e9}."], 422);
        }

        $exists = Enrollment::query()
            ->where('user_id', $user->id)
            ->where('course_id', $data['course_id'])
            ->exists();

        if ($exists) {
            return response()->json(['message' => "Cette personne est d\u{e9}j\u{e0} inscrite \u{e0} ce cours."], 422);
        }

        if (! $user->is_student) {
            $user->is_student = true;
            $user->save();
            $activity->log($request->user(), 'user.student_enabled', $user, ['email' => $user->email]);
        }

        $enrollment = Enrollment::query()->create([
            'user_id' => $user->id,
            'course_id' => (int) $data['course_id'],
            'progress' => 0,
        ]);

        $activity->log($request->user(), 'enrollment.created', $enrollment, [
            'user_id' => $user->id,
            'course_id' => $enrollment->course_id,
        ]);

        return response()->json(['data' => ['id' => $enrollment->id]], 201);
    }
}