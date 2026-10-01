<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->current()]);
    }

    public function update(Request $request, SettingsService $settings, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'pickup_fee' => ['required', 'integer', 'min:0', 'max:1000000'],
            'dakar_fee' => ['required', 'integer', 'min:0', 'max:1000000'],
            'regions_fee' => ['required', 'integer', 'min:0', 'max:1000000'],
            'low_stock_threshold' => ['required', 'integer', 'min:0', 'max:10000'],
        ]);

        $before = $this->current();
        $settings->set($data);
        $settings->apply();

        $activity->log($request->user(), 'settings.updated', null, ['before' => $before, 'after' => $data]);

        return response()->json(['data' => $this->current()]);
    }

    /** @return array<string, int> */
    private function current(): array
    {
        return [
            'pickup_fee' => (int) config('shipping.pickup_fee', 0),
            'dakar_fee' => (int) config('shipping.zones.dakar.fee', 0),
            'regions_fee' => (int) config('shipping.zones.regions.fee', 0),
            'low_stock_threshold' => (int) config('shop.low_stock_threshold', 5),
        ];
    }
}