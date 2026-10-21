<?php

namespace App\Support;

use Illuminate\Support\Str;

final class PlainText
{
    /** Retire la syntaxe ## / puces / **gras** pour les aperçus (partage, meta). */
    public static function from(?string $text, int $limit = 150): string
    {
        $t = strip_tags((string) $text);
        $t = preg_replace('/^\s*(#{1,3}|[-•*]|\d+[.)])\s+/mu', '', $t) ?? $t;
        $t = str_replace('**', '', $t);
        $t = trim(preg_replace('/\s+/u', ' ', $t) ?? $t);

        return Str::limit($t, $limit);
    }
}