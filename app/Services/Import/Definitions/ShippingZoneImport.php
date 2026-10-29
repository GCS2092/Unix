<?php

namespace App\Services\Import\Definitions;

use App\Models\ShippingZone;
use App\Models\User;
use App\Services\Import\ImportDefinition;
use App\Support\Countries;
use Illuminate\Database\Eloquent\Model;

class ShippingZoneImport extends ImportDefinition
{
    public function key(): string { return 'shipping-zones'; }
    public function label(): string { return 'Zones de livraison'; }
    public function scope(): string { return 'shop'; }
    public function immutable(): array { return ['code']; }

    public function fields(): array
    {
        return [
            'code' => ['label' => 'Code', 'column' => 'code', 'type' => 'slug', 'separator' => '_', 'max' => 20, 'required' => true, 'key' => true,
                'help' => 'Identifiant unique (lettres minuscules, chiffres, _). Non modifiable : les commandes y font référence.',
                'aliases' => ['code', 'reference', 'ref', 'identifiant']],
            'label_fr' => ['label' => 'Libellé', 'column' => 'libelle', 'type' => 'string', 'max' => 100, 'required' => true, 'key' => true,
                'help' => 'Nom de la zone en français.',
                'aliases' => ['libelle', 'label', 'nom', 'zone', 'label fr', 'libelle fr', 'nom zone']],
            'label_en' => ['label' => 'Libellé (anglais)', 'column' => 'libelle_en', 'type' => 'string', 'max' => 100,
                'help' => 'Nom de la zone en anglais.',
                'aliases' => ['libelle en', 'label en', 'english label', 'nom en']],
            'fee' => ['label' => 'Frais', 'column' => 'frais', 'type' => 'int', 'max' => 1000000, 'required' => true,
                'help' => 'Frais de livraison, nombre entier.',
                'aliases' => ['frais', 'tarif', 'prix', 'fee', 'cout', 'frais de livraison']],
            'country' => ['label' => 'Pays', 'column' => 'pays', 'type' => 'enum', 'values' => array_values(Countries::CODES),
                'help' => 'Code pays sur 2 lettres (SN, CI...). Vide = SN.',
                'aliases' => ['pays', 'country', 'code pays']],
            'is_active' => ['label' => 'Actif', 'column' => 'actif', 'type' => 'bool',
                'help' => 'oui ou non.',
                'aliases' => ['actif', 'active', 'visible', 'statut']],
            'position' => ['label' => 'Position', 'column' => 'position', 'type' => 'int', 'max' => 32000,
                'help' => 'Ordre d\'affichage.',
                'aliases' => ['position', 'ordre', 'rang', 'order']],
            'id' => ['label' => 'ID', 'column' => 'id', 'type' => 'id', 'key' => true, 'virtual' => true,
                'help' => 'Identifiant interne (présent dans les exports).',
                'aliases' => ['id']],
        ];
    }

    public function example(): array
    {
        return ['code' => 'dakar', 'label_fr' => 'Dakar centre', 'label_en' => 'Dakar centre', 'fee' => 2000, 'country' => 'SN', 'is_active' => 'oui', 'position' => 1];
    }

    public function find(array $d): ?Model
    {
        if (isset($d['id']) && ($m = ShippingZone::query()->find($d['id']))) {
            return $m;
        }
        if (isset($d['code']) && ($m = ShippingZone::query()->where('code', $d['code'])->first())) {
            return $m;
        }
        if (isset($d['label_fr'])) {
            return ShippingZone::query()->whereRaw('LOWER(label_fr) = ?', [mb_strtolower($d['label_fr'])])->first();
        }

        return null;
    }

    public function create(array $attrs, ?User $admin): Model
    {
        return ShippingZone::query()->create($attrs + [
            'country' => 'SN',
            'is_active' => true,
            'position' => (int) ShippingZone::query()->max('position') + 1,
        ]);
    }
}