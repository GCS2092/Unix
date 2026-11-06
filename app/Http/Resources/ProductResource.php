<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
class ProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // L'API admin renvoie les valeurs brutes (a editer) ; la boutique recoit la langue courante.
        $admin = $request->is('api/v1/admin/*');

        return [
            'id' => $this->id,
            'name' => $admin ? $this->name : $this->localizedName(),
            'slug' => $this->slug,
            'description' => $admin ? $this->description : $this->localizedDescription(),
            'name_en' => $this->when($admin, $this->name_en),
            'description_en' => $this->when($admin, $this->description_en),
            'image_url' => $this->imageUrl(),
            'images' => array_values(array_filter([
                $this->imageUrl(),
                ...$this->images->map(fn ($image) => $image->url())->all(),
            ])),
            'thumbs' => array_values(array_filter([
                $this->thumbUrl(),
                ...$this->images->map(fn ($image) => $image->thumbUrl())->all(),
            ])),
            'specs' => $admin ? $this->specs : $this->localizedExtra('specs'),
            'delivery_info' => $admin ? $this->delivery_info : $this->localizedExtra('delivery_info'),
            'specs_en' => $this->when($admin, $this->specs_en),
            'delivery_info_en' => $this->when($admin, $this->delivery_info_en),
            'share_url' => rtrim(config('app.url'), '/').'/p/'.$this->slug,
            'image_link' => $this->when($admin, $this->image_link),
            'gallery' => $this->when($admin, fn () => $this->images->map(fn ($image) => ['id' => $image->id, 'url' => $image->url()])->values()->all()),
            'category_id' => $this->category_id,
            'components' => $this->whenLoaded('components', fn () => $this->components->map(fn ($c) => [
                'id' => $c->id,
                'name' => $admin ? $c->name : $c->localizedName(),
                'slug' => $c->slug,
                'price' => $c->price,
                'image_url' => $c->thumbUrl(),
                'quantity' => (int) $c->pivot->quantity,
                'in_stock' => $c->availableStock() > 0,
            ])->values()->all()),
            'components_value' => $this->whenLoaded('components', fn () => (int) $this->components->sum(fn ($c) => $c->price * (int) $c->pivot->quantity)),
            'kind' => $this->kind ?? 'device',
            'accessories' => $this->whenLoaded('accessories', fn () => $this->accessories->map(fn ($a) => [
                'id' => $a->id,
                'name' => $admin ? $a->name : $a->localizedName(),
                'slug' => $a->slug,
                'price' => $a->price,
                'image_url' => $a->thumbUrl(),
                'in_stock' => $a->availableStock() > 0,
                'max_quantity' => max(0, min(99, $a->availableStock())),
                'is_required' => (bool) $a->pivot->is_required,
            ])->values()->all()),
            'compatible_devices' => $this->whenLoaded('compatibleDevices', fn () => $this->compatibleDevices->map(fn ($d) => [
                'id' => $d->id,
                'name' => $admin ? $d->name : $d->localizedName(),
                'slug' => $d->slug,
            ])->values()->all()),
            'course_id' => $this->when($admin, $this->course_id),
            'category' => $this->category ? [
                'id' => $this->category->id,
                'name' => $admin ? $this->category->name : $this->category->localizedName(),
                'slug' => $this->category->slug,
            ] : null,
            'price' => $this->price,
            // Donnees internes : jamais exposees a la boutique
            'cost_price' => $this->when($admin, $this->cost_price),
            'margin' => $this->when($admin, fn () => $this->cost_price === null ? null : $this->price - $this->cost_price),
            'margin_rate' => $this->when($admin, fn () => ($this->cost_price === null || $this->price <= 0) ? null : round(($this->price - $this->cost_price) / $this->price * 100, 1)),
            'stock' => $this->when($request->user()?->is_admin, $this->availableStock()),
            'in_stock' => $this->availableStock() > 0,
            'low_stock' => ($this->availableStock() > 0 && $this->availableStock() <= (int) config('shop.low_stock_threshold', 5)) ? $this->availableStock() : null,
            'max_quantity' => max(0, min(99, $this->availableStock())),
            'is_published' => $this->when($request->user()?->is_admin, $this->is_published),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}