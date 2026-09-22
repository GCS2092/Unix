<?php

namespace App\Policies;

use App\Models\Enrollment;
use App\Models\User;

class EnrollmentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Enrollment $enrollment): bool
    {
        return $user->is_admin || $enrollment->user_id === $user->id;
    }

    public function update(User $user, Enrollment $enrollment): bool
    {
        return $user->is_admin || $enrollment->user_id === $user->id;
    }
}
