<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Services\ExchangeRateService;
use Illuminate\Http\JsonResponse;

class CurrencyController extends Controller
{
    public function index(ExchangeRateService $rates): JsonResponse
    {
        return response()->json([
            'data' => [
                'base' => config('currency.base'),
                'rates' => $rates->rates(),
            ],
        ]);
    }
}