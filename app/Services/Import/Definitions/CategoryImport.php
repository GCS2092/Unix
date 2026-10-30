<?php

namespace App\Services\Import\Definitions;

use App\Models\Category;
use App\Models\User;
use App\Services\Import\ImportDefinition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class CategoryImport extends ImportDefinition
{
    public function key(): string { return 'categories'; }
    public function label(): string { return 'Catégories'; }
    public function scope(): string { return 'shop'; }
    public function immutable(): array { return ['slug']; }

    public function fields(): array
    {
        return [
            'name' => ['label' => 'Nom', 'column' => 'nom', 'type' => 'string', 'max' => 255, 'required' => true, 'key' => true,
                'help' => 'Nom de la catégorie. Sert aussi à retrouver une catégorie existante.',
                'aliases' => ['nom', 'name', 'categorie', 'category', 'libelle', 'titre', 'intitule']],
            'name_en' => ['label' => 'Nom (anglais)', 'column' => 'nom_en', 'type' => 'string', 'max' => 255,
                'help' => 'Nom en anglais.',
                'aliases' => ['nom en', 'name en', 'english name', 'nom anglais', 'categorie en']],
            'slug' => ['label' => 'Slug', 'column' => 'slug', 'type' => 'slug', 'max' => 255, 'key' => true,
                'help' => 'Identifiant unique utilisé dans les URL. Non modifiable ensuite.',
                'aliases' => ['slug', 'reference', 'ref', 'code']],
            'position' => ['label' => 'Position', 'column' => 'position', 'type' => 'int', 'max' => 32000,
                'help' => 'Ordre d\'affichage (nombre entier).',
                'aliases' => ['position', 'ordre', 'rang', 'order', 'tri']],
            'is_active' => ['label' => 'Actif', 'column' => 'actif', 'type' => 'bool',
                'help' => 'oui ou non.',
                'aliases' => ['actif', 'active', 'publie', 'visible', 'statut', 'en ligne']],
            'id' => ['label' => 'ID', 'column' => 'id', 'type' => 'id', 'key' => true, 'virtual' => true,
                'help' => 'Identifiant interne (présent dans les exports).',
                'aliases' => ['id', 'identifiant']],
        ];
    }

    public function example(): array
    {
        return ['name' => 'Accessoires', 'name_en' => 'Accessories', 'slug' => 'accessoires', 'position' => 1, 'is_active' => 'oui'];
    }

    public function find(array $d): ?Model
    {
        if (isset($d['id']) && ($m = Category::query()->find($d['id']))) {
            return $m;
        }
        if (isset($d['slug']) && ($m = Category::query()->where('slug', $d['slug'])->first())) {
            return $m;
        }
        if (isset($d['name'])) {
            return Category::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($d['name'])])->first();
        }

        return null;
    }

    public function create(array $attrs, ?User $admin): Model
    {
        $slug = $attrs['slug'] ?? (Str::slug($attrs['name']) ?: 'categorie');
        while (Category::query()->where('slug', $slug)->exists()) {
            $slug .= '-'.Str::lower(Str::random(4));
        }

        return Category::query()->create($attrs + ['slug' => $slug, 'position' => 0, 'is_active' => true]);
    }
}