<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Complements du site : uniquement les champs qui n'existent pas deja dans
 * ShopSettings / CommunicationSettings / AboutSettings. Stockes dans settings sous "site.<champ>".
 */
class SiteInfo
{
    public const PREFIX = 'site.';

    /** champ => [section, type, public, longueur max] */
    public const SCHEMA = [
        'brand_colors' => ['identity', 'string', true, 120],
        'trust_points' => ['identity', 'json', true, 0],
        'mail_from_address' => ['identity', 'email', false, 190],
        'whatsapp_staff' => ['contact', 'string', true, 200],
        'whatsapp_message_fr' => ['contact', 'string', true, 300],
        'whatsapp_message_en' => ['contact', 'string', true, 300],
        'vat_enabled' => ['legal', 'bool', true, 0],
        'vat_rate' => ['legal', 'int', true, 0],
        'pickup_enabled' => ['delivery', 'bool', true, 0],
        'payment_methods' => ['payment', 'json', true, 0],
        'cinetpay_status' => ['payment', 'string', false, 20],
        'certificate_condition' => ['formation', 'string', true, 160],
        'certificate_mention_fr' => ['formation', 'string', true, 255],
        'certificate_mention_en' => ['formation', 'string', true, 255],
        'live_schedule' => ['formation', 'string', true, 255],
        'live_audience' => ['formation', 'string', true, 20],
    ];

    public static function all(bool $publicOnly = false): array
    {
        try {
            $rows = Setting::query()->where('key', 'like', self::PREFIX.'%')->pluck('value', 'key')->all();
        } catch (\Throwable) {
            $rows = [];
        }
        $out = [];
        foreach (self::SCHEMA as $field => $d) {
            if ($publicOnly && ! $d[2]) { continue; }
            $out[$field] = self::decode($d[1], $rows[self::PREFIX.$field] ?? null);
        }

        return $out;
    }

    public static function get(string $field): mixed
    {
        return self::all()[$field] ?? null;
    }

    public static function save(array $data): void
    {
        foreach (self::SCHEMA as $field => $d) {
            if (! array_key_exists($field, $data)) { continue; }
            Setting::query()->updateOrCreate(['key' => self::PREFIX.$field], ['value' => self::encode($d[1], $data[$field])]);
        }
    }

    public static function rules(): array
    {
        $rules = [];
        foreach (self::SCHEMA as $field => $d) {
            $rules[$field] = match ($d[1]) {
                'bool' => ['nullable', 'boolean'],
                'int' => ['nullable', 'integer', 'min:0', 'max:100'],
                'json' => ['nullable', 'array', 'max:20'],
                'email' => ['nullable', 'email', 'max:'.$d[3]],
                default => ['nullable', 'string', 'max:'.$d[3]],
            };
        }

        return $rules;
    }

    private static function decode(string $type, ?string $raw): mixed
    {
        return match ($type) {
            'bool' => ($raw === null || $raw === '') ? null : in_array($raw, ['1', 'true'], true),
            'int' => ($raw === null || $raw === '') ? null : (int) $raw,
            'json' => ($raw === null || $raw === '') ? [] : (json_decode($raw, true) ?: []),
            default => $raw ?? '',
        };
    }

    private static function encode(string $type, mixed $v): string
    {
        if ($v === null || $v === '') { return ''; }

        return match ($type) {
            'bool' => $v ? '1' : '0',
            'json' => (string) json_encode((array) $v, JSON_UNESCAPED_UNICODE),
            default => trim((string) $v),
        };
    }
}