<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class EmailCodeController extends Controller
{
    /** (Re)envoie l'e-mail contenant le code et le bouton. Une demande par minute. */
    public function send(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->email_verified_at !== null) {
            return response()->json(['data' => ['verified' => true]]);
        }

        $key = 'email-code-send:'.$user->id;
        if (! Cache::add($key, 1, now()->addSeconds(60))) {
            return response()->json(['message' => 'Patientez une minute avant de demander un nouveau code.'], 429);
        }

        try {
            $user->notify(new VerifyEmailNotification);
        } catch (\Throwable $e) {
            Cache::forget($key);
            report($e);

            return response()->json(['message' => "L'e-mail n'a pas pu être envoyé."], 500);
        }

        return response()->json(['data' => ['sent' => true]]);
    }

    /** Valide le code saisi par l'etudiant connecte. */
    public function confirm(Request $request, OrderFulfillmentService $fulfillment): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'digits:6']]);
        $user = $request->user();

        if ($user->email_verified_at !== null) {
            return response()->json(['data' => ['verified' => true, 'attached_orders' => 0]]);
        }

        $row = EmailVerificationCode::query()->where('user_id', $user->id)->first();
        if ($row === null || $row->code_expires_at === null || $row->code_expires_at->isPast()) {
            return response()->json(['message' => 'Code expiré. Demandez un nouveau code.'], 422);
        }
        if ($row->attempts >= EmailVerificationCode::MAX_ATTEMPTS) {
            return response()->json(['message' => 'Trop d\'essais. Demandez un nouveau code.'], 429);
        }

        if (! hash_equals($row->code_hash, EmailVerificationCode::hashCode($user->id, $data['code']))) {
            $row->increment('attempts');
            $left = max(0, EmailVerificationCode::MAX_ATTEMPTS - $row->attempts);

            return response()->json(['message' => $left > 0
                ? "Code incorrect. Il reste {$left} essai(s)."
                : 'Code incorrect. Demandez un nouveau code.'], 422);
        }

        return response()->json(['data' => ['verified' => true, 'attached_orders' => $this->markVerified($user, $row, $fulfillment)]]);
    }

    /** Valide le jeton du bouton de l'e-mail (POST envoye par la page du site, sans connexion requise). */
    public function confirmLink(Request $request, OrderFulfillmentService $fulfillment): JsonResponse
    {
        $data = $request->validate([
            'id' => ['required', 'integer'],
            'token' => ['required', 'string', 'size:40'],
        ]);

        $user = User::query()->find($data['id']);
        $row = $user ? EmailVerificationCode::query()->where('user_id', $user->id)->first() : null;

        $ok = $user !== null && $row !== null && $row->token_hash !== null
            && hash_equals($row->token_hash, hash('sha256', $data['token']))
            && $row->token_expires_at !== null && ! $row->token_expires_at->isPast();

        if (! $ok) {
            return response()->json(['message' => 'Lien invalide, expiré ou déjà utilisé. Demandez un nouvel e-mail depuis votre compte.'], 422);
        }
        if ($user->is_blocked) {
            return response()->json(['message' => 'Ce compte est suspendu.'], 422);
        }

        return response()->json(['data' => ['verified' => true, 'attached_orders' => $this->markVerified($user, $row, $fulfillment)]]);
    }

    private function markVerified(User $user, EmailVerificationCode $row, OrderFulfillmentService $fulfillment): int
    {
        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
        $row->delete();

        return (int) $fulfillment->attachGuestOrdersToUser($user);
    }
}