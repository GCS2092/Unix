<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;

class OrderNotificationController extends Controller
{
    public function resendConfirmation(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        if (! $order->isPaid()) {
            return response()->json(['message' => 'Seule une commande payee peut recevoir cet e-mail.'], 422);
        }

        $email = $order->recipientEmail();
        if ($email === null) {
            return response()->json(['message' => 'Cette commande n\'a pas d\'adresse e-mail.'], 422);
        }

        $order->loadMissing('user');
        $recipient = $order->user ?? User::query()->where('email', $email)->first();
        if ($recipient) {
            $recipient->notify(new OrderPaidNotification($order));
        } else {
            Notification::route('mail', $email)->notify(new OrderPaidNotification($order));
        }

        $activity->log($request->user(), 'order.confirmation_resent', $order, ['email' => $email]);

        return response()->json(['data' => ['sent_to' => $email]]);
    }
}