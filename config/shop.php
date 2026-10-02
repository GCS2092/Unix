<?php

return [
    // Durée pendant laquelle une commande en attente garde son stock réservé.
    'reservation_minutes' => (int) env('SHOP_RESERVATION_MINUTES', 30),
];