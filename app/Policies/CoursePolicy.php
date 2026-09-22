<?php

namespace App\Policies;

use App\Models\Course;
use App\Models\User;

class CoursePolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Course $course): bool
    {
        return $course->is_published || ($user !== null && $user->is_admin);
    }

    public function create(User $user): bool
    {
        return $user->is_admin;
    }

    public function update(User $user, Course $course): bool
    {
        return $user->is_admin;
    }

    public function delete(User $user, Course $course): bool
    {
        return $user->is_admin;
    }

    public function stream(User $user, Course $course): bool
    {
        if ($user->is_admin) {
            return true;
        }

        return $course->enrollments()
            ->where('user_id', $user->id)
            ->exists();
    }

    public function joinLiveSession(User $user, Course $course): bool
    {
        return $this->stream($user, $course);
    }
}
