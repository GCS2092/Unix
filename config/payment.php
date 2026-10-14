<?php

return [
    // cinetpay = vrai paiement ; fake = simulation locale (refusée en production)
    'driver' => env('PAYMENT_DRIVER', 'cinetpay'),

    // true = paiement manuel (Wave, Orange Money...) : pas de redirection, instructions affichees au client
    'manual' => (bool) env('PAYMENT_MANUAL', false),
];