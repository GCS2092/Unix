<?php

namespace App\Http\Resources;

use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Order */
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
            'subtotal' => $this->subtotal,
            'delivery_fee' => $this->delivery_fee,
            'currency' => $this->currency,
            'delivery_method' => $this->delivery_method,
            'delivery_zone' => $this->delivery_zone,
            'phone' => $this->phone,
            'city' => $this->city,
            'district' => $this->district,
            'address' => $this->address,
            'landmark' => $this->landmark,
            'note' => $this->note,
            'paid_at' => $this->paid_at,
            'reservation_expires_at' => $this->status->value === 'pending' ? $this->reservation_expires_at : null,
            'stock_conflict' => $this->when($request->user()?->is_admin, (bool) $this->stock_conflict),
            'fulfillment_status' => in_array($this->delivery_method, ['delivery', 'pickup'], true) ? $this->fulfillment_status?->value : null,
            'guest_email' => $this->when($request->user()?->is_admin, $this->guest_email),
            'guest_name' => $this->when($request->user()?->is_admin, $this->guest_name),
            'user' => UserResource::make($this->whenLoaded('user')),
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            'carrier' => $this->carrier,
            'tracking_number' => $this->tracking_number,
            'pickup_note' => $this->pickup_note,
            'serial_numbers' => $this->serial_numbers,
            'warranty_months' => $this->warranty_months,
            'received_confirmed_at' => $this->received_confirmed_at,
            'events' => $this->whenLoaded('events', fn () => $this->events->map(fn ($e) => ['step' => $e->step, 'at' => $e->created_at])->values()),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}