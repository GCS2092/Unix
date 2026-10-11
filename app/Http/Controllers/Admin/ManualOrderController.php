<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\ManualOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ManualOrderController extends Controller
{
    public function store(Request $request, ManualOrderService $service): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'guest_name' => ['required_without:user_id', 'nullable', 'string', 'max:255'],
            'guest_email' => ['nullable', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:30', 'regex:/^\+?[0-9 .\-]{8,20}$/'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'items.*.unit_price' => ['nullable', 'integer', 'min:0'],
            'delivery_method' => ['required', Rule::in(['delivery', 'pickup'])],
            'delivery_zone' => ['nullable', Rule::exists('shipping_zones', 'code')],
            'delivery_fee' => ['nullable', 'integer', 'min:0', 'max:1000000'],
            'city' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'landmark' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
            'source' => ['required', Rule::in(ManualOrderService::SOURCES)],
            'payment_method' => ['nullable', Rule::in(ManualOrderService::PAYMENT_METHODS)],
            'paid' => ['sometimes', 'boolean'],
        ]);

        try {
            $order = $service->create($request->user(), $data);
        } catch (InsufficientStockException $e) {
            return response()->json($e->toResponseData(), 422);
        }

        return response()->json(['data' => OrderResource::make($order)], 201);
    }
}