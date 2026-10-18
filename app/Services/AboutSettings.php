<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Storage;

/** Page "A propos" : textes, liens, bannieres et galeries (avec etat masque), stockes dans settings. */
class AboutSettings
{
    public const FIELDS = [
        'tagline_fr', 'tagline_en', 'story_fr', 'story_en',
        'youtube', 'x', 'linkedin', 'snapchat', 'telegram', 'website',
    ];

    public const BANNERS = ['home', 'about'];

    public const GALLERIES = ['story', 'shop', 'courses', 'support'];

    public const MAX_GALLERY = 3;

    private function url(string $path): string
    {
        return Storage::disk('public')->url($path);
    }

    /** @return array<int, array{path: string, hidden: bool}> */
    private function parseItems(string $raw): array
    {
        $list = json_decode($raw !== '' ? $raw : '[]', true);
        if (! is_array($list)) {
            return [];
        }
        $out = [];
        foreach ($list as $i) {
            if (is_string($i) && $i !== '') {
                $out[] = ['path' => $i, 'hidden' => false];
            } elseif (is_array($i) && ! empty($i['path'])) {
                $out[] = ['path' => (string) $i['path'], 'hidden' => (bool) ($i['hidden'] ?? false)];
            }
        }
        return $out;
    }

    public function all(bool $admin = false): array
    {
        $keys = array_map(fn ($f) => "about.$f", self::FIELDS);
        foreach (self::BANNERS as $s) {
            $keys[] = "about.banner_$s";
            $keys[] = "about.banner_{$s}_hidden";
        }
        foreach (self::GALLERIES as $g) {
            $keys[] = "about.gallery_$g";
        }
        $rows = Setting::whereIn('key', $keys)->pluck('value', 'key');

        $out = [];
        foreach (self::FIELDS as $f) {
            $out[$f] = (string) ($rows["about.$f"] ?? '');
        }
        foreach (self::BANNERS as $s) {
            $path = (string) ($rows["about.banner_$s"] ?? '');
            $hidden = (string) ($rows["about.banner_{$s}_hidden"] ?? '') === '1';
            $out["banner_{$s}_url"] = $path !== '' && ($admin || ! $hidden) ? $this->url($path) : '';
            $out["banner_{$s}_hidden"] = $hidden;
        }
        foreach (self::GALLERIES as $g) {
            $items = $this->parseItems((string) ($rows["about.gallery_$g"] ?? ''));
            $out["gallery_$g"] = array_values(array_map(
                fn ($i) => $this->url($i['path']),
                array_filter($items, fn ($i) => ! $i['hidden'])
            ));
            if ($admin) {
                $out["gallery_{$g}_items"] = array_map(
                    fn ($i) => ['url' => $this->url($i['path']), 'hidden' => $i['hidden']],
                    $items
                );
            }
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
        $this->deleteBannerFile($slot);
        Setting::updateOrCreate(['key' => "about.banner_$slot"], ['value' => $path]);
        Setting::updateOrCreate(['key' => "about.banner_{$slot}_hidden"], ['value' => '']);
    }

    public function removeBanner(string $slot): void
    {
        $this->deleteBannerFile($slot);
        Setting::updateOrCreate(['key' => "about.banner_$slot"], ['value' => '']);
        Setting::updateOrCreate(['key' => "about.banner_{$slot}_hidden"], ['value' => '']);
    }

    public function setBannerHidden(string $slot, bool $hidden): void
    {
        Setting::updateOrCreate(['key' => "about.banner_{$slot}_hidden"], ['value' => $hidden ? '1' : '']);
    }

    private function deleteBannerFile(string $slot): void
    {
        $old = (string) Setting::where('key', "about.banner_$slot")->value('value');
        if ($old !== '') {
            Storage::disk('public')->delete($old);
        }
    }

    private function items(string $section): array
    {
        return $this->parseItems((string) Setting::where('key', "about.gallery_$section")->value('value'));
    }

    private function saveItems(string $section, array $items): void
    {
        Setting::updateOrCreate(['key' => "about.gallery_$section"], ['value' => json_encode(array_values($items))]);
    }

    public function galleryCount(string $section): int
    {
        return count($this->items($section));
    }

    public function addGalleryImage(string $section, string $path): void
    {
        $items = $this->items($section);
        $items[] = ['path' => $path, 'hidden' => false];
        $this->saveItems($section, $items);
    }

    public function removeGalleryImage(string $section, int $index): void
    {
        $items = $this->items($section);
        if (! isset($items[$index])) {
            return;
        }
        Storage::disk('public')->delete($items[$index]['path']);
        unset($items[$index]);
        $this->saveItems($section, $items);
    }

    public function setGalleryHidden(string $section, int $index, bool $hidden): void
    {
        $items = $this->items($section);
        if (! isset($items[$index])) {
            return;
        }
        $items[$index]['hidden'] = $hidden;
        $this->saveItems($section, $items);
    }
}