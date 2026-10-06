<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use App\Notifications\LiveInvitationNotification;
use Illuminate\Support\Facades\DB;

class LiveAudience
{
    /**
     * Inscrits au cours + personnes deja invitees (hors admins).
     *
     * @return array<int, array{user: User, path: string}>
     */
    public static function recipients(Course $course, ?int $exceptUserId = null): array
    {
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
            return [];
        }

        $enrolledSet = $enrolledIds->flip();
        $out = [];

        foreach (User::query()->whereIn('id', $ids)->where('is_admin', false)->get() as $user) {
            $path = $enrolledSet->has($user->id)
                ? '/etudiant/direct/'.$course->id
                : ($token ? '/rejoindre/'.$token : null);

            if ($path !== null) {
                $out[] = ['user' => $user, 'path' => $path];
            }
        }

        return $out;
    }
}