<?php

namespace App\Http\Controllers\Storefront;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutStatusController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'transaction_id' => ['required', 'string', 'max:100'],
        ]);

        $order = Order::query()
            ->where('payment_transaction_id', $validated['transaction_id'])
            ->first();

        if ($order === null) {
            return response()->json(['message' => __('checkout.order_not_found')], 404);
        }

        return response()->json([
            'data' => [
                'order_id' => $order->id,
                'status' => $order->status->value,
                'status_label' => $order->status->label(),
                'total' => $order->total,
                'currency' => $order->currency,
                'paid_at' => $order->paid_at,
                'reservation_expires_at' => $order->status === OrderStatus::Pending ? $order->reservation_expires_at : null,
                'is_paid' => $order->isPaid(),
                'is_failed' => $order->status === OrderStatus::Failed,
            ],
        ]);
    }
}