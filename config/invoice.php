<?php

return [
    'name'    => env('INVOICE_COMPANY_NAME', env('APP_NAME', 'Unix')),
    'address' => env('INVOICE_COMPANY_ADDRESS', 'Dakar, Sénégal'),
    'phone'   => env('INVOICE_COMPANY_PHONE'),
    'email'   => env('INVOICE_COMPANY_EMAIL'),
    'ninea'   => env('INVOICE_COMPANY_NINEA'),
];