<?php

namespace App\Services\Import\Concerns;

use Illuminate\Support\Str;

trait ParsesCells
{
    protected function norm(string $s): string
    {
        $s = str_replace("\xEF\xBB\xBF", '', $s);
        $s = Str::ascii(mb_strtolower($s));

        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $s));
    }

    protected function str(mixed $v): string
    {
        if ($v === null) {
            return '';
        }
        if ($v instanceof \DateTimeInterface) {
            return $v->format('Y-m-d');
        }
        if (is_bool($v)) {
            return $v ? '1' : '0';
        }
        if (is_float($v) && floor($v) == $v) {
            return (string) (int) $v;
        }

        return (string) preg_replace('/^[\s\x{00A0}\x{202F}]+|[\s\x{00A0}\x{202F}]+$/u', '', (string) $v);
    }

    protected function blank(mixed $v): bool
    {
        return $this->str($v) === '';
    }

    protected function blankRow(array $cells): bool
    {
        foreach ($cells as $c) {
            if (! $this->blank($c)) {
                return false;
            }
        }

        return true;
    }

    /** Entier tolere : "1 500 FCFA", "1.500", "1,500.50", 5.0 ... null si illisible. */
    protected function parseInt(mixed $v, bool $floor = false): ?int
    {
        if (is_int($v)) {
            return $v;
        }
        if (is_float($v)) {
            return $floor ? (int) floor($v) : (int) round($v);
        }
        $s = (string) preg_replace('/[^0-9.,\-]/u', '', mb_strtolower($this->str($v)));
        if ($s === '' || ! preg_match('/\d/', $s)) {
            return null;
        }
        $neg = str_starts_with($s, '-');
        $s = ltrim($s, '-');
        if (str_contains($s, '-')) {
            return null;
        }
        $hasDot = str_contains($s, '.');
        $hasCom = str_contains($s, ',');
        if ($hasDot && $hasCom) {
            $dec = strrpos($s, '.') > strrpos($s, ',') ? '.' : ',';
            $th = $dec === '.' ? ',' : '.';
            $s = str_replace($dec, '.', str_replace($th, '', $s));
        } elseif ($hasDot || $hasCom) {
            $parts = explode($hasDot ? '.' : ',', $s);
            $last = end($parts);
            if (count($parts) > 2 || (strlen($last) === 3 && strlen($parts[0]) >= 1 && strlen($parts[0]) <= 3)) {
                $s = implode('', $parts);
            } else {
                $s = $parts[0].'.'.$parts[1];
            }
        }
        if (! is_numeric($s)) {
            return null;
        }
        $n = $floor ? (int) floor((float) $s) : (int) round((float) $s);

        return $neg ? -$n : $n;
    }

    protected function parseBool(string $s): ?bool
    {
        $s = $this->norm($s);

        return match (true) {
            in_array($s, ['oui', 'o', 'yes', 'y', 'true', 'vrai', '1', 'publie', 'en ligne', 'actif', 'visible', 'on'], true) => true,
            in_array($s, ['non', 'n', 'no', 'false', 'faux', '0', 'brouillon', 'inactif', 'masque', 'off'], true) => false,
            default => null,
        };
    }
}