<?php

namespace App\Support\Export;

use App\Support\Export\Definitions\CategoryExport;
use App\Support\Export\Definitions\CourseExport;
use App\Support\Export\Definitions\FaqExport;
use App\Support\Export\Definitions\OrderExport;
use App\Support\Export\Definitions\OrderLineExport;
use App\Support\Export\Definitions\ProductExport;
use App\Support\Export\Definitions\ShippingZoneExport;

final class ExportRegistry
{
    /** @return array<string, ExportDefinition> */
    public static function all(): array
    {
        $defs = [
            new ProductExport, new CategoryExport, new ShippingZoneExport, new CourseExport,
            new OrderExport, new OrderLineExport, new FaqExport('shop'), new FaqExport('formation'),
        ];

        return collect($defs)->keyBy(fn (ExportDefinition $d) => $d->key())->all();
    }

    public static function get(string $key): ExportDefinition
    {
        return self::all()[$key] ?? abort(404, 'Ressource inconnue.');
    }

    /** @return list<string> */
    public static function keysForScope(string $scope): array
    {
        return array_keys(array_filter(self::all(), fn (ExportDefinition $d) => $d->scope() === $scope));
    }
}