<?php

namespace App\Policies;

use App\Models\Certificate;
use App\Models\User;

class CertificatePolicy
{
    public function view(User $user, Certificate $certificate): bool
    {
        $certificate->loadMissing('enrollment');

        return $user->is_admin || $certificate->enrollment->user_id === $user->id;
    }
}
