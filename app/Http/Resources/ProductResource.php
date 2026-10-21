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
            'course_id' => $this->when($admin, $this->course_id),
            'category' => $this->category ? [
                'id' => $this->category->id,
                'name' => $admin ? $this->category->name : $this->category->localizedName(),
                'slug' => $this->category->slug,
            ] : null,
            'price' => $this->price,
            'stock' => $this->when($request->user()?->is_admin, $this->stock),
            'in_stock' => (int) $this->stock > 0,
            'low_stock' => ((int) $this->stock > 0 && (int) $this->stock <= (int) config('shop.low_stock_threshold', 5)) ? (int) $this->stock : null,
            'max_quantity' => max(0, min(99, (int) $this->stock)),
            'is_published' => $this->when($request->user()?->is_admin, $this->is_published),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}