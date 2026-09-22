<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Order */
class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'total' => $this->total,
            'currency' => $this->currency,
            'paid_at' => $this->paid_at,
            'guest_email' => $this->when($request->user()?->is_admin, $this->guest_email),
            'guest_name' => $this->when($request->user()?->is_admin, $this->guest_name),
            'user' => UserResource::make($this->whenLoaded('user')),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
