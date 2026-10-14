<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

/** Reglages "Communications et suivi", modifiables par l'admin (table settings, prefixe comms.). */
class CommunicationSettings
{
    private const CACHE_KEY = 'comms_settings';

    private const PREFIX = 'comms.';

    /** Valeurs par defaut : le type de chaque valeur fixe aussi son type de lecture/stockage. */
    public const DEFAULTS = [
        'shop_name' => 'UNIX',
        'support_email' => '',
        'support_whatsapp' => '',
        'pickup_place' => '',
        'pickup_hours' => '',
        'pickup_requirements' => '',
        'prep_days' => 0,
        'message_fr' => '',
        'message_en' => '',
        'announcement_fr' => '',
        'announcement_en' => '',
        'default_warranty_months' => 0,
        'attach_invoice' => true,
        'send_stage_emails' => true,
        'invite_account_cta' => true,
        'pay_wave' => '',
        'pay_orange_money' => '',
        'pay_free_money' => '',
        'pay_transfer' => '',
        'pay_note_fr' => '',
        'pay_note_en' => '',
    ];

    /** @return array<string, mixed> */
    public function all(): array
    {
        $stored = Cache::remember(
            self::CACHE_KEY,
            3600,
            fn () => Setting::query()->where('key', 'like', self::PREFIX.'%')->pluck('value', 'key')->all()
        );

        $out = [];
        foreach (self::DEFAULTS as $key => $default) {
            $raw = $stored[self::PREFIX.$key] ?? null;
            if ($raw === null) {
                $out[$key] = $default;

                continue;
            }
            $out[$key] = match (true) {
                is_bool($default) => $raw === '1',
                is_int($default) => (int) $raw,
                default => (string) $raw,
            };
        }

        return $out;
    }

    public function get(string $key): mixed
    {
        return $this->all()[$key] ?? null;
    }

    /** Texte libre dans la langue de la commande (vide si non renseigne dans cette langue). */
    public function localized(string $base, ?string $locale): string
    {
        $suffix = str_starts_with((string) $locale, 'en') ? '_en' : '_fr';

        return (string) $this->get($base.$suffix);
    }

    /** @param array<string, mixed> $values */
    public function set(array $values): void
    {
        foreach ($values as $key => $value) {
            if (! array_key_exists($key, self::DEFAULTS)) {
                continue;
            }
            $stored = is_bool(self::DEFAULTS[$key]) ? ($value ? '1' : '0') : (string) $value;
            Setting::query()->updateOrCreate(['key' => self::PREFIX.$key], ['value' => $stored]);
        }
        Cache::forget(self::CACHE_KEY);
    }

    /** Coordonnees de paiement manuel montrees au client (commande en attente seulement). @return array<string, string> */
    public function paymentInfo(): array
    {
        $a = $this->all();

        return [
            'wave' => (string) $a['pay_wave'],
            'orange_money' => (string) $a['pay_orange_money'],
            'free_money' => (string) $a['pay_free_money'],
            'transfer' => (string) $a['pay_transfer'],
            'note_fr' => (string) $a['pay_note_fr'],
            'note_en' => (string) $a['pay_note_en'],
            'whatsapp' => (string) $a['support_whatsapp'],
        ];
    }

    /** Ce que la page de suivi (publique) a le droit de connaitre. @return array<string, string> */
    public function publicView(): array
    {
        $all = $this->all();

        return [
            'shop_name' => (string) $all['shop_name'],
            'support_email' => (string) $all['support_email'],
            'support_whatsapp' => (string) $all['support_whatsapp'],
            'announcement_fr' => (string) $all['announcement_fr'],
            'announcement_en' => (string) $all['announcement_en'],
        ];
    }
}