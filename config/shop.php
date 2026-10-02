<?php

return [
    // Durée pendant laquelle une commande en attente garde son stock réservé.
    'reservation_minutes' => (int) env('SHOP_RESERVATION_MINUTES', 30),

    // En dessous (ou égal), le catalogue signale "stock bas" et l'admin filtre ces produits.
    'low_stock_threshold' => (int) env('SHOP_LOW_STOCK_THRESHOLD', 5),
];
