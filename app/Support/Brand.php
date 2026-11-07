<?php

namespace App\Support;

/** Identite visuelle par espace : boutique (BETCC) et formation (IGA). */
final class Brand
{
    private static string $current = 'shop';

    /** Espace du prochain e-mail (l'en-tete le lit une fois puis revient a la boutique). */
    public static function useSpace(?string $space): void
    {
        self::$current = self::normalize($space);
    }

    public static function consume(): string
    {
        $s = self::$current;
        self::$current = 'shop';

        return $s;
    }

    public static function normalize(?string $space): string
    {
        return $space === 'formation' ? 'formation' : 'shop';
    }

    public static function name(?string $space = 'shop'): string
    {
        return self::normalize($space) === 'formation' ? 'IGA' : 'BETCC';
    }

    public static function color(?string $space = 'shop'): string
    {
        return self::normalize($space) === 'formation' ? '#1f64c0' : '#2b3150';
    }

    public static function accent(?string $space = 'shop'): string
    {
        return self::normalize($space) === 'formation' ? '#3fa535' : '#f39c1f';
    }

    /** URL publique du logo PNG (les e-mails ne lisent ni le SVG ni les chemins locaux). */
    public static function logoUrl(?string $space = 'shop'): string
    {
        $file = self::normalize($space) === 'formation' ? 'logo-iga.png' : 'logo-betcc-email.png';

        return rtrim((string) config('app.url'), '/').'/brand/'.$file;
    }
}