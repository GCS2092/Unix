<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderPaymentService;
use App\Services\StockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Order::class);

        $orders = Order::query()
            ->where('user_id', $request->user()->id)
            ->with('items.itemable')
            ->latest('id')
            ->get();

        return response()->json([
            'data' => OrderResource::collection($orders),
        ]);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        $this->authorize('view', $order);

        $order->load('items.itemable', 'user', 'events');

        return response()->json([
            'data' => OrderResource::make($order),
        ]);
    }

    public function retryPayment(
        Request $request,
        OrderPaymentService $payments,
        StockService $stock,
    ): JsonResponse {
        if (! $request->user()) {
            return response()->json([
                'message' => __('api.order.unauthenticated'),
            ], 401);
        }

        $orderId = $request->route('order');

        if ($orderId instanceof Order) {
            $orderId = $orderId->getKey();
        }

        $order = Order::query()->findOrFail($orderId);

        if ((string) $order->user_id !== (string) $request->user()->getKey()) {
            return response()->json([
                'message' => __('api.order.not_yours'),
            ], 403);
        }

        if ($order->isPaid()) {
            return response()->json([
                'message' => __('api.order.already_paid'),
            ], 422);
        }

        if (! in_array($order->status, [OrderStatus::Pending, OrderStatus::Failed], true)) {
            return response()->json([
                'message' => __('api.order.cannot_retry'),
            ], 422);
        }

        try {
            DB::transaction(function () use ($order, $stock): void {
                $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

                if (! in_array($locked->status, [OrderStatus::Pending, OrderStatus::Failed], true)) {
                    throw new \RuntimeException(__('api.order.cannot_retry'));
                }

                $expiresAt = now()->addMinutes((int) config('shop.reservation_minutes', 30));

                if (! $locked->stock_reserved) {
                    // Réservation expirée ou paiement échoué : on reprend le stock, ou on refuse.
                    $stock->reserve($locked, $expiresAt);
                } else {
                    $locked->forceFill(['reservation_expires_at' => $expiresAt])->save();
                }

                if ($locked->status === OrderStatus::Failed) {
                    $locked->update(['status' => OrderStatus::Pending]);
                }
            });

            $order->refresh();
            $payment = $payments->initiatePayment($order);
        } catch (InsufficientStockException $exception) {
            return response()->json($exception->toResponseData(), 422);
        } catch (\RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'payment_url' => $payment['payment_url'],
            'transaction_id' => $payment['transaction_id'],
            'reservation_expires_at' => $order->reservation_expires_at,
        ]);
    }
}
