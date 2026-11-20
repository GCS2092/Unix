<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Avoir : contre-passation d'une facture emise. Jamais modifie, jamais supprime. */
class CreditNote extends Model
{
    protected $fillable = [
        'invoice_id', 'order_id', 'number', 'kind', 'issued_at', 'reason',
        'customer_name', 'customer_address', 'currency', 'subtotal', 'delivery_fee', 'total',
        'locale', 'items', 'seller',
    ];

    protected function casts(): array
    {
        return ['issued_at' => 'datetime', 'items' => 'array', 'seller' => 'array'];
    }

    protected static function booted(): void
    {
        static::updating(function (): void {
            throw new \LogicException('Un avoir emis ne peut pas etre modifie.');
        });
        static::deleting(function (): void {
            throw new \LogicException('Un avoir emis ne peut pas etre supprime.');
        });
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}