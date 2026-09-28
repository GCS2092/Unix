<?php

// Le backend stocke tout en XOF. Les autres devises servent uniquement a l'affichage.
return [
    'base' => 'XOF',
    'supported' => ['XOF', 'EUR', 'USD'],
    'eur_peg' => 655.957, // parite fixe officielle EUR/XOF
    'api_url' => env('EXCHANGE_RATE_API_URL', 'https://open.er-api.com/v6/latest/XOF'),
    // Taux de secours (1 XOF = x devise) si l'API est indisponible
    'fallback_rates' => [
        'XOF' => 1,
        'EUR' => 1 / 655.957,
        'USD' => 1 / 600,
    ],
];