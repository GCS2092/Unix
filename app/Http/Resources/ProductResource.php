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
            'image_link' => $this->when($admin, $this->image_link),
            'price' => $this->price,
            'stock' => $this->when($request->user()?->is_admin, $this->stock),
            'is_published' => $this->when($request->user()?->is_admin, $this->is_published),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}