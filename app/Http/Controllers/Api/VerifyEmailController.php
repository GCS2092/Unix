<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class VerifyEmailController extends Controller
{
    /** Lien recu par e-mail (signe par le middleware "signed") : confirme l'adresse puis rattache les commandes invite. */
    public function verify(int $id, string $hash, OrderFulfillmentService $fulfillment): RedirectResponse
    {
        $user = User::query()->findOrFail($id);
        abort_unless(hash_equals(sha1(strtolower((string) $user->email)), $hash), 403);

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        $attached = $fulfillment->attachGuestOrdersToUser($user);
        $base = rtrim((string) config('app.frontend_url'), '/');

        return redirect()->away($base.'/commandes?verified='.$attached);
    }

    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->email_verified_at === null) {
            try {
                $user->notify(new VerifyEmailNotification);
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json(['data' => ['sent' => true]]);
    }
}