<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CertificateSetting extends Model
{
    protected $fillable = ['key', 'value'];

    public const DEFAULTS = [
        'brand' => '',
        'signer_name' => '',
        'signer_title' => '',
        'color' => '#0b4a6f',
        'logo' => '',
        'signature' => '',
    ];

    /** @return array<string, string> */
    public static function values(): array
    {
        try {
            $rows = static::query()->pluck('value', 'key')->all();
        } catch (\Throwable) {
            $rows = [];
        }
        $out = self::DEFAULTS;
        foreach (self::DEFAULTS as $k => $_) {
            if (array_key_exists($k, $rows) && $rows[$k] !== null) {
                $out[$k] = (string) $rows[$k];
            }
        }

        return $out;
    }

    /** @param array<string, string|null> $data */
    public static function put(array $data): void
    {
        foreach ($data as $k => $v) {
            if (array_key_exists($k, self::DEFAULTS)) {
                static::query()->updateOrCreate(['key' => $k], ['value' => (string) ($v ?? '')]);
            }
        }
    }
}