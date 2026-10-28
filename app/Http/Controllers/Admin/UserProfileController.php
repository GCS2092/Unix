<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserProfileController extends Controller
{
    public function update(Request $request, User $user, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'gender' => ['sometimes', 'nullable', 'in:male,female'],
            'birth_date' => ['sometimes', 'nullable', 'date', 'before:today', 'after:1900-01-01'],
            'birth_place' => ['sometimes', 'nullable', 'string', 'max:120'],
            'birth_country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'nationality' => ['sometimes', 'nullable', 'string', 'size:2'],
            'country' => ['sometimes', 'nullable', 'string', 'size:2'],
            'city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'profession' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $user->update($data);
        $activity->log($request->user(), 'user.profile_corrected', $user, ['fields' => array_keys($data)]);

        return response()->json(['data' => $user->fresh()]);
    }

    public function verifyEmail(Request $request, User $user, ActivityLogger $activity): JsonResponse
    {
        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
            $activity->log($request->user(), 'user.email_verified_by_admin', $user, ['email' => $user->email]);
        }

        return response()->json(['data' => ['email_verified' => true]]);
    }
}