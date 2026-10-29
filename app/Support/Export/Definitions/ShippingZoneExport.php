<?php

namespace App\Support\Export\Definitions;

use App\Models\ShippingZone;
use App\Support\Export\ExportDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class ShippingZoneExport extends ExportDefinition
{
    public function key(): string { return 'shipping-zones'; }
    public function label(): string { return 'Zones de livraison'; }
    public function scope(): string { return 'shop'; }

    public function query(Request $request): Builder
    {
        return ShippingZone::query();
    }

    public function columns(): array
    {
        return [
            'code' => fn (ShippingZone $z) => $z->code,
            'libelle' => fn (ShippingZone $z) => $z->label_fr,
            'libelle_en' => fn (ShippingZone $z) => $z->label_en,
            'frais' => fn (ShippingZone $z) => (int) $z->fee,
            'pays' => fn (ShippingZone $z) => $z->country,
            'actif' => fn (ShippingZone $z) => $z->is_active ? 'oui' : 'non',
            'position' => fn (ShippingZone $z) => (int) $z->position,
            'id' => fn (ShippingZone $z) => $z->id,
        ];
    }
}