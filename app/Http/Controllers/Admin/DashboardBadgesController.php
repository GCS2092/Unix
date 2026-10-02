<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;

class DashboardBadgesController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['data' => [
            'orders_to_process' => Order::query()
                ->where('status', 'paid')
                ->whereIn('delivery_method', ['delivery', 'pickup'])
                ->whereIn('fulfillment_status', ['received', 'preparing'])
                ->count(),
            'orders_pending' => Order::query()->where('status', 'pending')->count(),
        ]]);
    }
}