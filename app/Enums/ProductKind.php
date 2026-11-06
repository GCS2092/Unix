<?php

namespace App\Enums;

enum ProductKind: string
{
    case Device = 'device';       // appareil (station totale, GNSS, drone...)
    case Accessory = 'accessory'; // accessoire (trepied, prisme, batterie...)
    case Bundle = 'bundle';       // pack : compose d'autres produits, stock calcule
}