<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    private const CACHE_KEY = 'app_settings';

    /** @var array<string, string> cle de reglage => cle de config Laravel */
    private const MAP = [
        'pickup_fee' => 'shipping.pickup_fee',
        'dakar_fee' => 'shipping.zones.dakar.fee',
        'regions_fee' => 'shipping.zones.regions.fee',
        'low_stock_threshold' => 'shop.low_stock_threshold',
    ];

    /** @return array<string, mixed> */
    public function all(): array
    {
        return Cache::remember(self::CACHE_KEY, 3600, fn () => Setting::query()->pluck('value', 'key')->all());
    }

    /** @param array<string, int|string> $values */
    public function set(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::MAP)) {
                continue;
            }
            Setting::query()->updateOrCreate(['key' => $key], ['value' => (string) $value]);
        }
        Cache::forget(self::CACHE_KEY);
    }

    /** Surcharge la config avec les valeurs enregistrees en base. */
    public function apply(): void
    {
        $stored = $this->all();
        foreach (self::MAP as $key => $configKey) {
            if (isset($stored[$key]) && $stored[$key] !== '') {
                config([$configKey => (int) $stored[$key]]);
            }
        }
    }
}