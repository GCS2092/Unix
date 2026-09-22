<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $orders = Order::query()
            ->with(['user', 'items.itemable'])
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => OrderResource::collection($orders),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        $this->authorize('view', $order);

        $order->load(['user', 'items.itemable']);

        return response()->json([
            'data' => OrderResource::make($order),
        ]);
    }

    public function markPaid(Request $request, Order $order, OrderFulfillmentService $fulfillment): JsonResponse
    {
        $this->authorize('manage', Order::class);

        try {
            $fulfillment->markPaid($order);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'data' => OrderResource::make($order->fresh(['user', 'items.itemable'])),
        ]);
    }
}
