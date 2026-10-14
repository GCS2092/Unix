<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Le client declare avoir paye (paiement manuel). L'admin verifie puis valide. */
class PaymentClaimController extends Controller
{
    public function declare(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        abort_unless($order->user_id !== null && (int) $order->user_id === (int) $request->user()->getKey(), 403);

        return $this->claim($request, $order, $activity);
    }

    public function declareByToken(Request $request, string $token, ActivityLogger $activity): JsonResponse
    {
        $order = Order::query()->where('tracking_token', $token)->firstOrFail();

        return $this->claim($request, $order, $activity);
    }

    private function claim(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        if (! config('payment.manual')) {
            return response()->json(['message' => __('api.order.cannot_retry')], 422);
        }

        $data = $request->validate(['reference' => ['nullable', 'string', 'max:100']]);

        if ($order->isPaid()) {
            return $this->respond($order);
        }

        try {
            DB::transaction(function () use ($order, $data): void {
                $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

                if ($locked->isPaid()) {
                    return;
                }

                if (! in_array($locked->status, [OrderStatus::Pending, OrderStatus::Failed], true)) {
                    throw new \RuntimeException(__('api.order.only_pending'));
                }

                $updates = [
                    'payment_claimed_reference' => $data['reference'] ?? $locked->payment_claimed_reference,
                ];

                if ($locked->payment_claimed_at === null) {
                    $updates['payment_claimed_at'] = now();
                }

                // Pendant la verification, la commande ne doit pas expirer
                if ($locked->status === OrderStatus::Pending && $locked->stock_reserved) {
                    $until = now()->addHours((int) config('shop.claim_extension_hours', 24));
                    if ($locked->reservation_expires_at === null || $locked->reservation_expires_at->lt($until)) {
                        $updates['reservation_expires_at'] = $until;
                    }
                }

                $locked->update($updates);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        try {
            $activity->log($request->user(), 'order.payment_claimed', $order, [
                'reference' => $data['reference'] ?? null,
                'order_total' => $order->total,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        return $this->respond($order);
    }

    private function respond(Order $order): JsonResponse
    {
        return response()->json(['data' => OrderResource::make($order->fresh(['items.itemable', 'user', 'events']))]);
    }
}