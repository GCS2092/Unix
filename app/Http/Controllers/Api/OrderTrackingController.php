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
        $data = $request->validate(['ref' => ['required', 'string', 'max:30']]);

        $raw = strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', $data['ref']));
        $code = strlen($raw) === 11 && str_starts_with($raw, 'CMD') ? substr($raw, 3) : $raw;
        abort_unless(strlen($code) === 8, 404);

        $order = Order::query()
            ->where('public_ref', 'CMD-'.substr($code, 0, 4).'-'.substr($code, 4))
            ->firstOrFail();

        return response()->json(['data' => ['token' => $order->ensureTrackingToken()]]);
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