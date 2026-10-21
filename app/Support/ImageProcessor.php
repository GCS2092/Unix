<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Redimensionne et convertit en WebP (image 1600 px + miniature 480 px).
 * Fichiers produits : <id>_p.webp et <id>_t.webp. Sans GD/WebP, le fichier est stocke tel quel.
 */
final class ImageProcessor
{
    private const MAIN = 1600;
    private const THUMB = 480;
    private const QUALITY = 82;
    private const MAX_PIXELS = 40000000;

    public static function store(UploadedFile $file, string $dir, ?string $disk = null): string
    {
        $disk ??= MediaDisk::name();
        $dir = trim($dir, '/');

        if (self::available()) {
            try {
                $out = self::process((string) $file->getRealPath());
                if ($out !== null) {
                    $id = Str::random(32);
                    $fs = Storage::disk($disk);
                    $main = $dir.'/'.$id.'_p.webp';
                    $fs->put($main, $out[0]);
                    $fs->put($dir.'/'.$id.'_t.webp', $out[1]);

                    return $main;
                }
            } catch (Throwable $e) {
                report($e);
            }
        }

        return (string) $file->store($dir, ['disk' => $disk]);
    }

    /** Supprime le fichier et sa miniature eventuelle. */
    public static function delete(?string $path, ?string $disk = null): void
    {
        if (! is_string($path) || $path === '') {
            return;
        }
        try {
            $fs = Storage::disk($disk ?: 'public');
            $fs->delete($path);
            if (str_ends_with($path, '_p.webp')) {
                $fs->delete(substr($path, 0, -7).'_t.webp');
            }
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** Chemin de la miniature, ou null si le fichier n'en a pas. */
    public static function thumbPath(string $path): ?string
    {
        return str_ends_with($path, '_p.webp') ? substr($path, 0, -7).'_t.webp' : null;
    }

    private static function available(): bool
    {
        return extension_loaded('gd') && function_exists('imagewebp');
    }

    /** @return array{0: string, 1: string}|null */
    private static function process(string $file): ?array
    {
        $info = @getimagesize($file);
        if (! $info || ($info[0] * $info[1]) > self::MAX_PIXELS) {
            return null;
        }

        $img = match ($info['mime'] ?? '') {
            'image/jpeg' => @imagecreatefromjpeg($file),
            'image/png' => @imagecreatefrompng($file),
            'image/webp' => @imagecreatefromwebp($file),
            default => false,
        };
        if (! $img) {
            return null;
        }

        if (($info['mime'] ?? '') === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($file);
            $angle = match ((int) ($exif['Orientation'] ?? 1)) {
                3 => 180,
                6 => -90,
                8 => 90,
                default => 0,
            };
            if ($angle !== 0) {
                $rot = imagerotate($img, $angle, 0);
                if ($rot) {
                    $img = $rot;
                }
            }
        }

        if (! imageistruecolor($img)) {
            imagepalettetotruecolor($img);
        }
        imagealphablending($img, false);
        imagesavealpha($img, true);

        $main = self::fit($img, self::MAIN);
        $thumb = self::fit($main, self::THUMB);

        return [self::encode($main), self::encode($thumb)];
    }

    private static function fit(\GdImage $img, int $max): \GdImage
    {
        $w = imagesx($img);
        $h = imagesy($img);
        if ($w <= $max && $h <= $max) {
            return $img;
        }
        $scaled = $w >= $h ? imagescale($img, $max) : imagescale($img, (int) round($w * $max / $h), $max);

        return $scaled ?: $img;
    }

    private static function encode(\GdImage $img): string
    {
        imagealphablending($img, false);
        imagesavealpha($img, true);
        ob_start();
        imagewebp($img, null, self::QUALITY);

        return (string) ob_get_clean();
    }
}