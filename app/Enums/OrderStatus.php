<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'En attente',
            self::Paid => 'Payée',
            self::Failed => 'Échouée',
            self::Cancelled => 'Annulée',
        };
    }

    public function isPending(): bool
    {
        return $this === self::Pending;
    }
}
