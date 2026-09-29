<?php

return [
    // cinetpay = vrai paiement ; fake = simulation locale (refusée en production)
    'driver' => env('PAYMENT_DRIVER', 'cinetpay'),
];