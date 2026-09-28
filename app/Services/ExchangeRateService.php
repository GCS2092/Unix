<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExchangeRateService
{
    /** @return array<string, float> 1 XOF = x devise */
    public function rates(): array
    {
        return Cache::remember('exchange_rates', now()->addHours(6), fn () => $this->build());
    }

    private function build(): array
    {
        $supported = config('currency.supported');
        $rates = config('currency.fallback_rates');

        try {
            $response = Http::timeout(5)->get(config('currency.api_url'));
            if ($response->successful()) {
                $live = $response->json('rates', []);
                foreach ($supported as $code) {
                    if ($code !== 'XOF' && isset($live[$code]) && is_numeric($live[$code]) && $live[$code] > 0) {
                        $rates[$code] = (float) $live[$code];
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Taux de change indisponibles, utilisation des taux de secours', ['error' => $e->getMessage()]);
        }

        $rates['XOF'] = 1.0;
        $rates['EUR'] = 1 / (float) config('currency.eur_peg');

        return array_intersect_key($rates, array_flip($supported));
    }
}