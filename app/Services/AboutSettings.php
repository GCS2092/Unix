<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Storage;

/** Page "A propos" : textes, liens et bannieres, stockes dans la table settings. */
class AboutSettings
{
    public const FIELDS = [
        'tagline_fr', 'tagline_en', 'story_fr', 'story_en',
        'youtube', 'x', 'linkedin', 'snapchat', 'telegram', 'website',
    ];

    public const BANNERS = ['home', 'about'];

    public function all(): array
    {
        $keys = array_map(fn ($f) => "about.$f", self::FIELDS);
        foreach (self::BANNERS as $s) {
            $keys[] = "about.banner_$s";
        }
        $rows = Setting::whereIn('key', $keys)->pluck('value', 'key');

        $out = [];
        foreach (self::FIELDS as $f) {
            $out[$f] = (string) ($rows["about.$f"] ?? '');
        }
        foreach (self::BANNERS as $s) {
            $path = (string) ($rows["about.banner_$s"] ?? '');
            $out["banner_{$s}_url"] = $path !== '' ? Storage::disk('public')->url($path) : '';
        }
        return $out;
    }

    public function save(array $data): void
    {
        foreach (self::FIELDS as $f) {
            if (! array_key_exists($f, $data)) {
                continue;
            }
            Setting::updateOrCreate(['key' => "about.$f"], ['value' => (string) ($data[$f] ?? '')]);
        }
    }

    public function replaceBanner(string $slot, string $path): void
    {
        $this->deleteFile($slot);
        Setting::updateOrCreate(['key' => "about.banner_$slot"], ['value' => $path]);
    }

    public function removeBanner(string $slot): void
    {
        $this->deleteFile($slot);
        Setting::updateOrCreate(['key' => "about.banner_$slot"], ['value' => '']);
    }

    private function deleteFile(string $slot): void
    {
        $old = (string) Setting::where('key', "about.banner_$slot")->value('value');
        if ($old !== '') {
            Storage::disk('public')->delete($old);
        }
    }
}