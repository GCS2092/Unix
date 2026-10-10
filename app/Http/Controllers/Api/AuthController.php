<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::query()->create([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => $request->validated('password'),
        ]);

        // Les commandes invite ne sont rattachees qu'apres confirmation de l'adresse (lien envoye par e-mail)
        try {
            $user->notify(new VerifyEmailNotification);
        } catch (\Throwable $e) {
            report($e);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => UserResource::make($user),
            'token' => $token,
            'attached_orders' => 0,
            'email_verified' => false,
        ], 201);
    }

    public function login(LoginRequest $request, OrderFulfillmentService $fulfillment): JsonResponse
    {
        $user = User::query()->where('email', $request->validated('email'))->first();

        // Meme duree de calcul que l'e-mail existe ou non : pas de fuite par le temps de reponse
        $hash = $user?->password ?? Hash::make(Str::random(16));
        $valid = Hash::check($request->validated('password'), $hash);

        if (! $user || ! $valid) {
            throw ValidationException::withMessages([
                'email' => [__('api.auth.invalid_credentials')],
            ]);
        }

        if ($user->is_blocked) {
            throw ValidationException::withMessages([
                'email' => ['Ce compte est suspendu. Contactez le support.'],
            ]);
        }

        $verified = $user->email_verified_at !== null;
        $attached = $verified ? $fulfillment->attachGuestOrdersToUser($user) : 0;

        $deviceName = $request->validated('device_name') ?? 'api';
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'user' => UserResource::make($user),
            'token' => $token,
            'attached_orders' => $attached,
            'email_verified' => $verified,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => __('api.auth.logged_out')]);
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

        // Reponse identique que l'adresse existe ou non : on ne revele pas qui a un compte
        Password::sendResetLink($request->only('email'));

        return response()->json(['message' => __('api.auth.reset_link_sent')]);
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
                // Le lien a ete recu par e-mail : l'adresse est prouvee
                if ($user->email_verified_at === null) {
                    $user->forceFill(['email_verified_at' => now()])->save();
                }
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json(['message' => __('api.auth.token_invalid')], 422);
        }

        return response()->json(['message' => __('api.auth.password_updated')]);
    }
}