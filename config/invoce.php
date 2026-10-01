<?php

return [
    'name' => env('INVOICE_COMPANY', env('APP_NAME', 'UNIX')),
    'address' => env('INVOICE_ADDRESS', 'Dakar, Sénégal'),
    'phone' => env('INVOICE_PHONE', ''),
    'email' => env('INVOICE_EMAIL', ''),
    'ninea' => env('INVOICE_NINEA', ''),
];