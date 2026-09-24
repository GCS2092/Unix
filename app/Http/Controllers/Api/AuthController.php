<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(
        RegisterRequest $request,
        OrderFulfillmentService $fulfillment,
    ): JsonResponse {
        $user = User::query()->create([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => $request->validated('password'),
        ]);

        $fulfillment->attachGuestOrdersToUser($user);

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => UserResource::make($user),
            'token' => $token,
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->validated('email'))->first();

        if (! $user || ! Hash::check($request->validated('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Identifiants invalides.'],
            ]);
        }

        $deviceName = $request->validated('device_name') ?? 'api';
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'user' => UserResource::make($user),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Deconnecte.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => UserResource::make($request->user()),
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $status = Password::sendResetLink($request->only('email'));

        if ($status !== Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'Impossible d\'envoyer le lien de reinitialisation.'], 422);
        }

        return response()->json(['message' => 'Lien de reinitialisation envoye si l\'email existe.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $status = Password::reset(
            $validated,
            function (User $user, string $password): void {
                $user->update(['password' => $password]);
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Token invalide ou expire.'], 422);
        }

        return response()->json(['message' => 'Mot de passe mis a jour.']);
    }
}
