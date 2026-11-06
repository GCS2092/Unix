<?php

namespace App\Http\Controllers\Admin;

use App\Enums\FulfillmentStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Notifications\OrderPaidNotification;
use App\Notifications\OrderStatusNotification;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderNotificationController extends Controller
{
    /** Renvoie l'e-mail de confirmation de paiement (avec facture). */
    public function resendConfirmation(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        if (! $order->isPaid()) {
            return response()->json(['message' => "Seule une commande pay\u{e9}e peut recevoir cet e-mail."], 422);
        }

        $order->loadMissing('user');

        try {
            $email = $order->notifyCustomer(new OrderPaidNotification($order));
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => "L'envoi de l'e-mail a \u{e9}chou\u{e9}. R\u{e9}essayez ou pr\u{e9}venez le client autrement."], 500);
        }

        if ($email === null) {
            return response()->json(['message' => "Cette commande n'a pas d'adresse e-mail."], 422);
        }

        $activity->log($request->user(), 'order.confirmation_resent', $order, ['email' => $email]);

        return response()->json(['data' => ['sent_to' => $email]]);
    }

    /** Renvoie l'e-mail de l'etape de suivi actuelle (ex. apres avoir saisi le numero de suivi). */
    public function resendStep(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $step = $order->fulfillment_status?->value;
        if (! $order->isPaid() || $step === null || $step === FulfillmentStatus::Received->value) {
            return response()->json(['message' => "Aucune \u{e9}tape de suivi \u{e0} renvoyer pour cette commande."], 422);
        }

        $order->loadMissing('user');

        try {
            $email = $order->notifyCustomer(new OrderStatusNotification($order, $step));
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => "L'envoi de l'e-mail a \u{e9}chou\u{e9}. R\u{e9}essayez ou pr\u{e9}venez le client autrement."], 500);
        }

        if ($email === null) {
            return response()->json(['message' => "Cette commande n'a pas d'adresse e-mail."], 422);
        }

        $activity->log($request->user(), 'order.step_email_resent', $order, ['email' => $email, 'step' => $step]);

        return response()->json(['data' => ['sent_to' => $email, 'step' => $step]]);
    }
}