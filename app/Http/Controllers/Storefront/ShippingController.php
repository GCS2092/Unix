<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Models\ShippingZone;
use Illuminate\Http\JsonResponse;

class ShippingController extends Controller
{
    public function show(): JsonResponse
    {
        $zones = ShippingZone::query()->active()->orderBy('position')->orderBy('id')->get()
            ->map(fn (ShippingZone $z) => [
                'key' => $z->code,
                'fee' => (int) $z->fee,
                'label_fr' => $z->label_fr,
                'label_en' => $z->label_en ?: $z->label_fr,
            ])
            ->values();

        return response()->json(['data' => [
            'pickup_fee' => (int) config('shipping.pickup_fee', 0),
            'free_shipping_threshold' => (int) config('shop.free_shipping_threshold', 0),
            'min_order' => (int) config('shop.min_order', 0),
            'zones' => $zones,
        ]]);
    }
}