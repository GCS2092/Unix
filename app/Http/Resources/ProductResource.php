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
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'price' => $this->price,
            'stock' => $this->when($request->user()?->is_admin, $this->stock),
            'is_published' => $this->when($request->user()?->is_admin, $this->is_published),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
