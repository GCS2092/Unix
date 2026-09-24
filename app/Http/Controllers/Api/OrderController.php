<?php

namespace App\Http\Controllers\Api;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        $order->load('items.itemable', 'user');

        return response()->json([
            'data' => OrderResource::make($order),
        ]);
    }

    public function retryPayment(
        Request $request,
        OrderPaymentService $payments
    ): JsonResponse {
        if (! $request->user()) {
            return response()->json([
                'message' => 'Utilisateur non authentifie.',
            ], 401);
        }

        $orderId = $request->route('order');

        if ($orderId instanceof Order) {
            $orderId = $orderId->getKey();
        }

        $order = Order::query()->findOrFail($orderId);

        if ((string) $order->user_id !== (string) $request->user()->getKey()) {
            return response()->json([
                'message' => 'Cette commande ne vous appartient pas.',
            ], 403);
        }

        if ($order->isPaid()) {
            return response()->json([
                'message' => 'Cette commande est deja payee.',
            ], 422);
        }

        if (! in_array($order->status, [OrderStatus::Pending, OrderStatus::Failed], true)) {
            return response()->json([
                'message' => 'Cette commande ne peut pas etre relancee.',
            ], 422);
        }

        try {
            $payment = $payments->initiatePayment($order);
        } catch (\RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'payment_url' => $payment['payment_url'],
            'transaction_id' => $payment['transaction_id'],
        ]);
    }
}
