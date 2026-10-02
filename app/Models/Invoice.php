<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    protected $fillable = [
        'order_id', 'number', 'status', 'issued_at', 'cancelled_at',
        'customer_name', 'customer_email', 'customer_phone', 'customer_address',
        'currency', 'subtotal', 'delivery_fee', 'total', 'locale', 'items', 'seller',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'items' => 'array',
            'seller' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}