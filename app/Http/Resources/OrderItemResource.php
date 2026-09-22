<?php

namespace App\Http\Resources;

use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\OrderItem */
class OrderItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $itemable = $this->whenLoaded('itemable', fn () => $this->itemable);

        return [
            'id' => $this->id,
            'quantity' => $this->quantity,
            'unit_price' => $this->unit_price,
            'line_total' => $this->line_total,
            'item' => $this->whenLoaded('itemable', function () {
                if ($this->itemable instanceof Course) {
                    return [
                        'type' => 'course',
                        'id' => $this->itemable->id,
                        'title' => $this->itemable->title,
                        'slug' => $this->itemable->slug,
                    ];
                }

                return [
                    'type' => 'product',
                    'id' => $this->itemable->id,
                    'name' => $this->itemable->name,
                    'slug' => $this->itemable->slug,
                ];
            }),
            'itemable_type' => $this->itemable_type,
            'itemable_id' => $this->itemable_id,
        ];
    }
}
