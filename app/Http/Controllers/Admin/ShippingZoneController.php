<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ShippingZone;
use App\Support\Countries;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShippingZoneController extends Controller
{
    public function index(): JsonResponse
    {
        $counts = Order::query()
            ->whereNotNull('delivery_zone')
            ->selectRaw('delivery_zone, COUNT(*) as c')
            ->groupBy('delivery_zone')
            ->pluck('c', 'delivery_zone');

        $rows = ShippingZone::query()->orderBy('position')->orderBy('id')->get()
            ->map(fn (ShippingZone $z) => $this->row($z, (int) ($counts[$z->code] ?? 0)))
            ->values();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20', 'regex:/^[a-z0-9_]+$/', 'unique:shipping_zones,code'],
            'country' => ['sometimes', 'string', 'in:'.implode(',', Countries::CODES)],
            'label_fr' => ['required', 'string', 'max:100'],
            'label_en' => ['nullable', 'string', 'max:100'],
            'fee' => ['required', 'integer', 'min:0', 'max:1000000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $zone = ShippingZone::query()->create($data + [
            'position' => (int) ShippingZone::query()->max('position') + 1,
        ]);

        $activity->log($request->user(), 'shipping_zone.created', $zone, $data);

        return response()->json(['data' => $this->row($zone, 0)], 201);
    }

    /** Le code n'est pas modifiable : les commandes existantes y font reference. */
    public function update(Request $request, ShippingZone $zone, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'label_fr' => ['sometimes', 'required', 'string', 'max:100'],
            'label_en' => ['sometimes', 'nullable', 'string', 'max:100'],
            'fee' => ['sometimes', 'required', 'integer', 'min:0', 'max:1000000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $before = $zone->only(array_keys($data));
        $zone->update($data);

        $activity->log($request->user(), 'shipping_zone.updated', $zone, ['before' => $before, 'after' => $data]);

        return response()->json(['data' => $this->row($zone->refresh(), $zone->ordersCount())]);
    }

    public function destroy(Request $request, ShippingZone $zone, ActivityLogger $activity): JsonResponse
    {
        if ($zone->ordersCount() > 0) {
            return response()->json([
                'message' => 'Cette zone figure dans des commandes : désactive-la plutôt que de la supprimer.',
            ], 422);
        }

        $activity->log($request->user(), 'shipping_zone.deleted', null, ['code' => $zone->code]);
        $zone->delete();

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function row(ShippingZone $z, int $orders): array
    {
        return [
            'id' => $z->id,
            'code' => $z->code,
            'country' => $z->country ?? 'SN',
            'label_fr' => $z->label_fr,
            'label_en' => $z->label_en,
            'fee' => (int) $z->fee,
            'is_active' => (bool) $z->is_active,
            'orders_count' => $orders,
        ];
    }
}