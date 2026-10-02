<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class CartResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Collection<int, array<string, mixed>> $items */
        $items = collect($this->resource['items'] ?? []);

        return [
            'items' => $items->map(fn (array $item): array => [
                'type' => $item['type'],
                'id' => $item['id'],
                'title' => $item['title'],
                'slug' => $item['slug'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'],
                'line_total' => $item['line_total'],
                'image_url' => $item['model']->imageUrl(),
                'in_stock' => (int) $item['model']->stock > 0,
                'available_quantity' => max(0, (int) $item['model']->stock),
                'exceeds_stock' => $item['quantity'] > (int) $item['model']->stock,
            ])->values(),
            'total' => $this->resource['total'] ?? 0,
            'has_stock_issue' => $items->contains(fn (array $item): bool => $item['quantity'] > (int) $item['model']->stock),
        ];
    }
}
