<?php

namespace App\Enums;

enum FulfillmentStatus: string
{
    case Received = 'received';
    case Preparing = 'preparing';
    case Shipped = 'shipped';
    case Ready = 'ready';
    case Delivered = 'delivered';

    /**
     * Etapes valides selon le mode de livraison (vide = pas de suivi).
     *
     * @return list<self>
     */
    public static function stepsFor(?string $method): array
    {
        return match ($method) {
            'delivery' => [self::Received, self::Preparing, self::Shipped, self::Delivered],
            'pickup' => [self::Received, self::Preparing, self::Ready, self::Delivered],
            default => [],
        };
    }
}