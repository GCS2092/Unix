<?php

namespace App\Support\Export\Definitions;

use App\Models\Product;
use App\Support\Export\ExportDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/** En-tetes identiques au modele d'import : un export se reimporte tel quel. */
class ProductExport extends ExportDefinition
{
    public function key(): string { return 'products'; }
    public function label(): string { return 'Produits'; }
    public function scope(): string { return 'shop'; }
    public function ability(): ?array { return ['viewAny', Product::class]; }

    public function query(Request $request): Builder
    {
        return Product::query()->without('images')->with('category')
            ->when($request->query('published') === '1', fn ($q) => $q->where('is_published', true))
            ->when($request->query('published') === '0', fn ($q) => $q->where('is_published', false));
    }

    public function columns(): array
    {
        return [
            'nom' => fn (Product $p) => $p->name,
            'prix' => fn (Product $p) => (int) $p->price,
            'stock' => fn (Product $p) => (int) $p->stock,
            'slug' => fn (Product $p) => $p->slug,
            'categorie' => fn (Product $p) => $p->category?->name,
            'description' => fn (Product $p) => $p->description,
            'nom_en' => fn (Product $p) => $p->name_en,
            'description_en' => fn (Product $p) => $p->description_en,
            'publie' => fn (Product $p) => $p->is_published ? 'oui' : 'non',
            'image_link' => function (Product $p) {
                try {
                    return $p->imageUrl();
                } catch (\Throwable) {
                    return $p->image_link;
                }
            },
            'specs' => fn (Product $p) => $p->specs,
            'specs_en' => fn (Product $p) => $p->specs_en,
            'livraison' => fn (Product $p) => $p->delivery_info,
            'livraison_en' => fn (Product $p) => $p->delivery_info_en,
            'id' => fn (Product $p) => $p->id,
            'cree_le' => fn (Product $p) => $p->created_at,
        ];
    }
}