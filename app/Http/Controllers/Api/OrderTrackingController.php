<?php

namespace App\Http\Controllers\Api;

use App\Enums\FulfillmentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderTrackingController extends Controller
{
    /** Le client connecte confirme la reception de sa commande. */
    public function confirmReceived(Request $request, Order $order): JsonResponse
    {
        $this->authorize('view', $order);

        return $this->confirm($order);
    }

    /** Suivi sans compte : le lien secret recu par e-mail donne acces a UNE commande. */
    public function showByToken(string $token): JsonResponse
    {
        return response()->json(['data' => OrderResource::make($this->byToken($token))]);
    }

    public function confirmByToken(string $token): JsonResponse
    {
        return $this->confirm($this->byToken($token));
    }

    /** Suivi sans compte : retrouve une commande par son identifiant lisible (CMD-XXXX-XXXX). */
    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ref' => ['required', 'string', 'max:30'],
            'email' => ['required', 'email', 'max:120'],
        ]);

        $raw = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $data['ref']));
        $code = strlen($raw) === 11 && str_starts_with($raw, 'CMD') ? substr($raw, 3) : $raw;
        abort_unless(strlen($code) === 8, 404);

        // Blocage par identifiant : une attaque repartie sur plusieurs IP est aussi freinee
        $key = 'track-lookup:'.$code;
        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($key, 5)) {
            abort(429);
        }

        $order = Order::query()
            ->where('public_ref', 'CMD-'.substr($code, 0, 4).'-'.substr($code, 4))
            ->with('user')
            ->first();
        $email = $order?->recipientEmail();

        // Meme reponse 404 pour "identifiant inconnu" et "e-mail different" : aucune information ne fuite
        if ($order === null || $email === null || mb_strtolower(trim($email)) !== mb_strtolower(trim($data['email']))) {
            \Illuminate\Support\Facades\RateLimiter::hit($key, 900);
            abort(404);
        }

        \Illuminate\Support\Facades\RateLimiter::clear($key);

        return response()->json(['data' => ['token' => $order->ensureTrackingToken()]]);
    }
    /** Suivi sans compte : reprend le paiement d'une commande en attente ou echouee. */
    public function retryByToken(
        string $token,
        \App\Services\OrderPaymentService $payments,
        \App\Services\StockService $stock,
    ): JsonResponse {
        $order = $this->byToken($token);

        if ($order->isPaid()) {
            return response()->json(['message' => __('api.order.already_paid')], 422);
        }

        if (! in_array($order->status, [\App\Enums\OrderStatus::Pending, \App\Enums\OrderStatus::Failed], true)) {
            return response()->json(['message' => __('api.order.cannot_retry')], 422);
        }

        try {
            \Illuminate\Support\Facades\DB::transaction(function () use ($order, $stock): void {
                $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

                if (! in_array($locked->status, [\App\Enums\OrderStatus::Pending, \App\Enums\OrderStatus::Failed], true)) {
                    throw new \RuntimeException(__('api.order.cannot_retry'));
                }

                $expiresAt = now()->addMinutes((int) config('shop.reservation_minutes', 30));

                if (! $locked->stock_reserved) {
                    $stock->reserve($locked, $expiresAt);
                } else {
                    $locked->forceFill(['reservation_expires_at' => $expiresAt])->save();
                }

                if ($locked->status === \App\Enums\OrderStatus::Failed) {
                    $locked->update(['status' => \App\Enums\OrderStatus::Pending]);
                }
            });

            $order->refresh();
            $payment = $payments->initiatePayment($order);
        } catch (\App\Exceptions\InsufficientStockException $exception) {
            return response()->json($exception->toResponseData(), 422);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'payment_url' => $payment['payment_url'],
            'transaction_id' => $payment['transaction_id'],
            'reservation_expires_at' => $order->reservation_expires_at,
        ]);
    }

    private function byToken(string $token): Order
    {
        abort_unless(strlen($token) === 40, 404);

        return Order::query()
            ->where('tracking_token', $token)
            ->with(['items.itemable', 'events'])
            ->firstOrFail();
    }

    private function confirm(Order $order): JsonResponse
    {
        $english = app()->getLocale() === 'en';
        $allowed = [FulfillmentStatus::Shipped, FulfillmentStatus::Ready, FulfillmentStatus::Delivered];

        if (! $order->isPaid() || ! in_array($order->fulfillment_status, $allowed, true)) {
            return response()->json([
                'message' => $english ? 'This order cannot be confirmed yet.' : 'Cette commande ne peut pas encore être confirmée.',
            ], 422);
        }

        if ($order->received_confirmed_at === null) {
            $order->forceFill(['received_confirmed_at' => now()])->save();
        }

        return response()->json([
            'data' => OrderResource::make($order->fresh(['items.itemable', 'events', 'user'])),
        ]);
    }
}