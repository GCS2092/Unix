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
            'name' => ['sometimes', 'string', 'min:2', 'max:120', new \App\Rules\PersonName],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30', new \App\Rules\PhoneNumber],
            'gender' => ['sometimes', 'nullable', 'in:male,female'],
            'birth_date' => ['sometimes', 'nullable', 'date', 'before_or_equal:'.now()->subYears(16)->toDateString(), 'after_or_equal:'.now()->subYears(100)->toDateString()],
            'birth_place' => ['sometimes', 'nullable', 'string', 'max:120', 'regex:'.\App\Http\Controllers\Api\FormationSignupController::PLACE_RE],
            'birth_country' => ['sometimes', 'nullable', 'string', \Illuminate\Validation\Rule::in(\App\Support\CountryCodes::CODES)],
            'nationality' => ['sometimes', 'nullable', 'string', \Illuminate\Validation\Rule::in(\App\Support\CountryCodes::CODES)],
            'country' => ['sometimes', 'nullable', 'string', \Illuminate\Validation\Rule::in(\App\Support\CountryCodes::CODES)],
            'city' => ['sometimes', 'nullable', 'string', 'max:120', 'regex:'.\App\Http\Controllers\Api\FormationSignupController::PLACE_RE],
            'address' => ['sometimes', 'nullable', 'string', 'min:5', 'max:255'],
            'profession' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        if (! empty($data['phone'])) {
            $data['phone'] = \App\Rules\PhoneNumber::normalize($data['phone']) ?? $data['phone'];
        }

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