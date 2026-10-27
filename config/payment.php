<?php

return [
    // cinetpay = vrai paiement ; fake = simulation locale (refusée en production)
    'driver' => env('PAYMENT_DRIVER', 'cinetpay'),

    // true = paiement manuel (Wave, Orange Money...) : pas de redirection, instructions affichees au client
    'manual' => (bool) env('PAYMENT_MANUAL', false),

    // Duree de conservation des captures de paiement (jours), puis suppression automatique
    'proof_retention_days' => (int) env('PAYMENT_PROOF_RETENTION_DAYS', 90),
];