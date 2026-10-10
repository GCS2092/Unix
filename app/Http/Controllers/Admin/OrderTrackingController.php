<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderTrackingController extends Controller
{
    public function update(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate([
            'carrier' => ['nullable', 'string', 'max:80'],
            'tracking_number' => ['nullable', 'string', 'max:80'],
            'pickup_note' => ['nullable', 'string', 'max:255'],
            'serial_numbers' => ['nullable', 'string', 'max:2000'],
            'warranty_months' => ['nullable', 'integer', 'min:0', 'max:120'],
        ]);

        $order->update($data);

        $activity->log(
            $request->user(),
            'order.tracking_updated',
            $order,
            ['carrier' => $data['carrier'] ?? null, 'tracking_number' => $data['tracking_number'] ?? null],
        );

        return response()->json([
            'data' => OrderResource::make($order->fresh(['user', 'items.itemable', 'events'])),
        ]);
    }
}