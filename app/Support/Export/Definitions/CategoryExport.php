<?php

namespace App\Support\Export\Definitions;

use App\Models\Category;
use App\Support\Export\ExportDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class CategoryExport extends ExportDefinition
{
    public function key(): string { return 'categories'; }
    public function label(): string { return 'Catégories'; }
    public function scope(): string { return 'shop'; }

    public function query(Request $request): Builder
    {
        return Category::query()->withCount('products');
    }

    public function columns(): array
    {
        return [
            'nom' => fn (Category $c) => $c->name,
            'nom_en' => fn (Category $c) => $c->name_en,
            'slug' => fn (Category $c) => $c->slug,
            'position' => fn (Category $c) => (int) $c->position,
            'actif' => fn (Category $c) => $c->is_active ? 'oui' : 'non',
            'produits' => fn (Category $c) => (int) $c->products_count,
            'id' => fn (Category $c) => $c->id,
        ];
    }
}