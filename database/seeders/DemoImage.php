<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Support\ImageProcessor;
use Illuminate\Http\UploadedFile;

/** Images de demo : vraies photos (dossier demo-images) ou visuel genere (GD), via ImageProcessor (_p.webp + _t.webp). */
final class DemoImage
{
    /** @return list<string> */
    public static function files(string $key): array
    {
        $f = glob(database_path('seeders/demo-images/'.$key.'-*.jpg')) ?: [];
        sort($f);

        return $f;
    }

    private static function storeFile(string $file): string
    {
        return ImageProcessor::store(new UploadedFile($file, basename($file), 'image/jpeg', null, true), 'products', 'public');
    }

    /** Applique les vraies photos (principale + galerie). false si aucun fichier. */
    public static function apply(Product $p, string $key): bool
    {
        $f = self::files($key);
        if (! $f) {
            return false;
        }
        foreach ($p->images as $img) {
            $img->delete();
        }
        $p->update(['image_path' => self::storeFile($f[0]), 'image_disk' => 'public', 'image_link' => null]);
        foreach (array_slice($f, 1) as $i => $file) {
            $p->images()->create(['path' => self::storeFile($file), 'disk' => 'public', 'position' => $i + 1]);
        }

        return true;
    }

    public static function store(string $label, string $hex, string $tag = '', string $dir = 'products', string $disk = 'public'): string
    {
        $size = 1000;
        $im = imagecreatetruecolor($size, $size);
        [$r, $g, $b] = sscanf($hex, '%02x%02x%02x');

        for ($y = 0; $y < $size; $y++) {
            $k = $y / $size;
            $c = imagecolorallocate($im, (int) ($r * (1 - .45 * $k)), (int) ($g * (1 - .45 * $k)), (int) ($b * (1 - .45 * $k)));
            imageline($im, 0, $y, $size, $y, $c);
        }

        imagefilledellipse($im, 820, 180, 560, 560, imagecolorallocatealpha($im, 255, 255, 255, 105));
        imagefilledellipse($im, 140, 900, 380, 380, imagecolorallocatealpha($im, 255, 255, 255, 112));

        $white = imagecolorallocate($im, 255, 255, 255);
        $font = null;
        foreach (['C:\\Windows\\Fonts\\segoeuib.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'] as $f) {
            if (is_file($f)) {
                $font = $f;
                break;
            }
        }

        if ($font && function_exists('imagettftext')) {
            if ($tag !== '') {
                imagettftext($im, 30, 0, 70, 110, $white, $font, mb_strtoupper($tag));
            }
            $lines = explode("\n", wordwrap($label, 16, "\n", true));
            $lh = 92;
            $y = (int) (($size - count($lines) * $lh) / 2 + 70);
            foreach ($lines as $line) {
                $bb = imagettfbbox(54, 0, $font, $line);
                $x = (int) (($size - ($bb[2] - $bb[0])) / 2);
                imagettftext($im, 54, 0, $x, $y, $white, $font, $line);
                $y += $lh;
            }
        } else {
            imagestring($im, 5, 60, 60, $tag.' - '.iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $label), $white);
        }

        $tmp = tempnam(sys_get_temp_dir(), 'dm');
        imagepng($im, $tmp);
        imagedestroy($im);

        try {
            return ImageProcessor::store(new UploadedFile($tmp, 'demo.png', 'image/png', null, true), $dir, $disk);
        } finally {
            @unlink($tmp);
        }
    }
}