<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class ShippingZone extends Model
{
    protected $fillable = ['code', 'label_fr', 'label_en', 'fee', 'is_active', 'position', 'country'];

    protected function casts(): array
    {
        return [
            'fee' => 'integer',
            'is_active' => 'boolean',
            'position' => 'integer',
        ];
    }

    /** @param Builder<ShippingZone> $query */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function ordersCount(): int
    {
        return Order::query()->where('delivery_zone', $this->code)->count();
    }
}