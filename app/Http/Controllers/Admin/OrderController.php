<?php

namespace App\Http\Controllers\Admin;

use App\Enums\FulfillmentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\ActivityLogger;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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

    public function markPaid(
        Request $request,
        Order $order,
        OrderFulfillmentService $fulfillment,
        ActivityLogger $activity,
    ): JsonResponse {
        $this->authorize('manage', Order::class);

        $previousStatus = $order->status->value;

        try {
            $fulfillment->markPaid($order);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $activity->log(
            $request->user(),
            'order.marked_paid_manually',
            $order,
            [
                'previous_status' => $previousStatus,
                'order_total' => $order->total,
                'order_currency' => $order->currency,
            ],
        );

        return response()->json([
            'data' => OrderResource::make($order->fresh(['user', 'items.itemable'])),
        ]);
    }

    public function updateFulfillment(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        abort_unless($order->status->value === 'paid', 422, 'Commande non payée.');
        $this->authorize('manage', Order::class);

        $english = app()->getLocale() === 'en';

        if (! $order->isPaid()) {
            return response()->json([
                'message' => $english ? 'Only paid orders can be updated.' : 'Seule une commande payee peut etre mise a jour.',
            ], 422);
        }

        $steps = array_map(
            fn (FulfillmentStatus $step): string => $step->value,
            FulfillmentStatus::stepsFor($order->delivery_method),
        );

        if ($steps === []) {
            return response()->json([
                'message' => $english ? 'This order has no delivery tracking.' : 'Aucun suivi de livraison pour cette commande.',
            ], 422);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in($steps)],
        ]);

        $previous = $order->fulfillment_status?->value;

        $order->update(['fulfillment_status' => $validated['status']]);

        $activity->log(
            $request->user(),
            'order.fulfillment_updated',
            $order,
            ['previous' => $previous, 'new' => $validated['status']],
        );

        return response()->json([
            'data' => OrderResource::make($order->fresh(['user', 'items.itemable'])),
        ]);
    }
}
