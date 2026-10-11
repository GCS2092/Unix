<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/** Reglages boutique modifiables par l'admin (table settings, prefixe shop.). */
class ShopSettings
{
    private const CACHE_KEY = 'shop_settings';

    private const PREFIX = 'shop.';

    public const DEFAULTS = [
        'legal_name' => '',
        'legal_address' => '',
        'legal_phone' => '',
        'legal_email' => '',
        'ninea' => '',
        'rccm' => '',
        'invoice_footer' => '',
        'free_shipping_threshold' => 0,
        'min_order' => 0,
        'reservation_minutes' => 30,
        'mail_from_name' => '',
        'opening_hours' => '',
        'social_facebook' => '',
        'social_instagram' => '',
        'social_tiktok' => '',
        'terms_url' => '',
    ];

    /** reglage => cle de config('invoice') */
    private const INVOICE_MAP = [
        'legal_name' => 'name',
        'legal_address' => 'address',
        'legal_phone' => 'phone',
        'legal_email' => 'email',
        'ninea' => 'ninea',
        'rccm' => 'rccm',
        'invoice_footer' => 'footer',
    ];

    /** @return array<string, string> */
    private function stored(): array
    {
        return Cache::remember(
            self::CACHE_KEY,
            3600,
            fn () => Setting::query()->where('key', 'like', self::PREFIX.'%')->pluck('value', 'key')->all()
        );
    }

    /** Valeurs effectives : ce qui est enregistre, sinon la valeur actuelle de la config. @return array<string, mixed> */
    public function all(): array
    {
        $stored = $this->stored();
        $out = [];

        foreach (self::DEFAULTS as $key => $default) {
            if ($key === 'reservation_minutes') {
                $default = (int) config('shop.reservation_minutes', 30);
            } elseif (isset(self::INVOICE_MAP[$key])) {
                $default = (string) config('invoice.'.self::INVOICE_MAP[$key], '');
            }

            $raw = $stored[self::PREFIX.$key] ?? null;
            $out[$key] = $raw === null ? $default : (is_int($default) ? (int) $raw : (string) $raw);
        }

        return $out;
    }

    public function get(string $key): mixed
    {
        return $this->all()[$key] ?? null;
    }

    /** @param array<string, mixed> $values */
    public function set(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::DEFAULTS)) {
                continue;
            }
            Setting::query()->updateOrCreate(['key' => self::PREFIX.$key], ['value' => (string) $value]);
        }
        Cache::forget(self::CACHE_KEY);
    }

    /** Surcharge la config avec les valeurs enregistrees (appele au demarrage et apres chaque enregistrement). */
    public function apply(): void
    {
        $stored = $this->stored();
        $s = $this->all();

        foreach (self::INVOICE_MAP as $key => $configKey) {
            if (isset($stored[self::PREFIX.$key]) && $stored[self::PREFIX.$key] !== '') {
                config(['invoice.'.$configKey => $stored[self::PREFIX.$key]]);
            }
        }

        if (isset($stored[self::PREFIX.'reservation_minutes']) && $stored[self::PREFIX.'reservation_minutes'] !== '') {
            config(['shop.reservation_minutes' => (int) $stored[self::PREFIX.'reservation_minutes']]);
        }

        config([
            'shop.free_shipping_threshold' => (int) $s['free_shipping_threshold'],
            'shop.min_order' => (int) $s['min_order'],
        ]);

        if ($s['mail_from_name'] !== '') {
            config(['mail.from.name' => $s['mail_from_name']]);
        }

        // Le nom de la boutique (Communications) sert aussi d'en-tete et de signature aux e-mails
        $name = (string) app(CommunicationSettings::class)->get('shop_name');
        if ($name !== '') {
            config(['app.name' => $name]);
        }
    }
}