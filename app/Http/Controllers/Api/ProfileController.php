<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Rules\PersonName;
use App\Rules\PhoneNumber;
use Laravel\Sanctum\PersonalAccessToken;

class ProfileController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120', new PersonName],
            'phone' => ['nullable', 'string', 'max:30', new PhoneNumber],
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

        $user = $request->user();
        if (! empty($data['phone'])) {
            $data['phone'] = PhoneNumber::normalize($data['phone']) ?? $data['phone'];
        }

        $user->update($data);

        return response()->json(['user' => UserResource::make($user->fresh())]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => [__('portal.wrong_password')],
            ]);
        }

        $user->update(['password' => $data['password']]);

        $current = $user->currentAccessToken();
        if ($current instanceof PersonalAccessToken) {
            $user->tokens()->where('id', '!=', $current->id)->delete();
        }

        return response()->json(['message' => 'ok']);
    }
}