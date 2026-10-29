<?php

namespace App\Support\Import;

use App\Services\Import\Definitions\CategoryImport;
use App\Services\Import\Definitions\FaqImport;
use App\Services\Import\Definitions\ShippingZoneImport;
use App\Services\Import\ImportDefinition;

final class ImportRegistry
{
    /** @return array<string, ImportDefinition> */
    public static function all(): array
    {
        $defs = [new CategoryImport, new ShippingZoneImport, new FaqImport('shop'), new FaqImport('formation')];

        return collect($defs)->keyBy(fn (ImportDefinition $d) => $d->key())->all();
    }

    public static function get(string $key): ImportDefinition
    {
        return self::all()[$key] ?? abort(404, 'Ressource inconnue.');
    }

    /** @return list<string> */
    public static function keysForScope(string $scope): array
    {
        return array_keys(array_filter(self::all(), fn (ImportDefinition $d) => $d->scope() === $scope));
    }
}