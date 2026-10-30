<?php

namespace App\Services\Import;

use Illuminate\Support\Str;

/**
 * Associe les colonnes d'un fichier aux champs d'une ressource en combinant :
 *  - le titre de la colonne (alias + synonymes par type de champ, langue FR/EN/ES)
 *  - le contenu de la colonne (nombres, liens, oui/non, textes longs, valeurs repetees...)
 * Chaque champ n'est attribue qu'a une colonne (la meilleure).
 */
final class ColumnMatcher
{
    private const STOP = ['de', 'du', 'des', 'la', 'le', 'les', 'd', 'l', 'the', 'of', 'a', 'au', 'aux', 'et', 'and', 'in', 'fr', 'francais', 'french', 'el', 'los', 'las', 'del'];
    private const LANG_EN = ['en', 'english', 'anglais', 'eng'];
    private const IMG = '/\.(png|jpe?g|webp|gif|svg|avif|bmp)(\?.*)?$/i';
    private const BOOLS = ['oui', 'non', 'yes', 'no', 'true', 'false', 'vrai', 'faux', 'o', 'n', 'y', 'actif', 'inactif', 'publie', 'brouillon', 'visible', 'masque', 'on', 'off', '1', '0'];

    private const SYN = [
        'money' => ['prix', 'tarif', 'montant', 'cout', 'amount', 'cost', 'price', 'pvp', 'pu', 'ttc', 'ht', 'fcfa', 'xof', 'cfa', 'valeur', 'precio', 'unit price', 'prix unitaire', 'prix vente', 'selling price', 'frais', 'fee'],
        'qty' => ['stock', 'quantite', 'qte', 'qty', 'quantity', 'inventaire', 'dispo', 'disponible', 'disponibilite', 'reste', 'unite', 'units', 'cantidad', 'in stock', 'en stock'],
        'name' => ['nom', 'name', 'designation', 'libelle', 'titre', 'title', 'produit', 'product', 'article', 'intitule', 'item', 'product name', 'nom produit', 'denomination', 'nombre', 'label'],
        'label' => ['categorie', 'category', 'rayon', 'famille', 'type', 'gamme', 'collection', 'rubrique', 'groupe', 'categoria', 'section', 'theme'],
        'longtext' => ['description', 'desc', 'details', 'detail', 'descriptif', 'resume', 'presentation', 'texte', 'contenu', 'infos', 'informations', 'notes', 'commentaire', 'descripcion', 'caracteristiques', 'specifications', 'reponse', 'answer'],
        'slug' => ['slug', 'sku', 'reference', 'ref', 'code', 'identifiant', 'ean', 'gtin', 'barcode', 'code barre'],
        'id' => ['id', 'identifiant', 'uid', 'num', 'numero'],
        'bool' => ['publie', 'published', 'visible', 'actif', 'active', 'statut', 'status', 'etat', 'ligne', 'online', 'publication'],
        'url' => ['image', 'photo', 'visuel', 'illustration', 'vignette', 'picture', 'img', 'cover', 'lien', 'url', 'link', 'thumbnail', 'imagen', 'foto', 'pic'],
        'int' => ['position', 'ordre', 'rang', 'order', 'tri', 'sort'],
    ];

    private const WHY = [
        'money' => 'des nombres de type prix', 'qty' => 'des petits nombres entiers (quantités)', 'int' => 'des nombres entiers',
        'id' => 'des entiers tous différents', 'bool' => 'des valeurs oui/non', 'url' => 'des liens ou noms d\'images',
        'slug' => 'des identifiants en minuscules', 'longtext' => 'des textes longs', 'label' => 'des valeurs qui se répètent (catégories)',
        'name' => 'des textes courts tous différents', 'text' => 'du texte',
    ];

    /**
     * @param  array<int, mixed>  $headers  index de colonne => titre
     * @param  array<int, array<int, mixed>>  $values  index de colonne => valeurs d'echantillon
     * @param  array<string, array<string, mixed>>  $fields  cle => [label, aliases, column, type, kind]
     * @param  array<string, string>  $memory  titre normalise => champ
     * @return array<int, array<string, mixed>>
     */
    public static function suggest(array $headers, array $values, array $fields, array $memory = []): array
    {
        $kinds = [];
        foreach ($fields as $key => $meta) {
            $kinds[$key] = self::kindOf((string) $key, $meta);
        }

        $cols = [];
        foreach ($headers as $i => $raw) {
            $header = self::str($raw);
            $vals = array_values(array_filter(array_map(fn ($v) => self::str($v), $values[$i] ?? []), fn ($v) => $v !== ''));
            if ($header === '' && $vals === []) {
                continue;
            }
            $norm = self::norm($header);
            $nt = $norm === '' ? [] : explode(' ', $norm);
            $hEn = array_intersect($nt, ['english', 'anglais', 'eng']) !== [] || (end($nt) === 'en' && count($nt) > 1);
            $ht = self::tokens($norm);
            $prof = self::profile($vals);

            $cand = [];
            foreach ($fields as $key => $meta) {
                $kind = $kinds[$key];
                $fieldEn = str_ends_with((string) $key, '_en');
                $h = $ht === [] ? 0.0 : self::headerScore($ht, (string) $key, $meta, $kind);
                if ($h > 0 && $hEn !== $fieldEn) {
                    $h *= $hEn ? 0.5 : 0.4;
                }
                $c = $vals === [] ? 0.5 : self::contentScore($kind, $prof);
                $contradict = false;
                if ($h > 0) {
                    $contradict = $c === 0.0 && $vals !== [] && in_array($kind, ['money', 'qty', 'int', 'bool', 'url', 'slug', 'id'], true);
                    $score = $contradict ? 0.45 * $h : 0.6 * $h + 0.4 * $c;
                    $min = 0.45;
                } else {
                    $score = 0.65 * $c * ($fieldEn ? 0.6 : 1.0);
                    $min = 0.3;
                }
                $cand[$key] = ['score' => $score, 'min' => $min, 'h' => $h, 'contradict' => $contradict];
            }

            $cols[$i] = [
                'index' => (int) $i,
                'header' => $header,
                'samples' => array_slice(array_values(array_unique($vals)), 0, 3),
                'field' => null,
                'confidence' => 'none',
                'note' => null,
                '_norm' => $norm,
                '_cand' => $cand,
            ];
        }

        $takenBy = [];

        // 1. Correspondances memorisees (priorite absolue)
        foreach ($cols as $i => &$c) {
            $n = $c['_norm'];
            if ($n !== '' && isset($memory[$n], $fields[$memory[$n]]) && ! isset($takenBy[$memory[$n]])) {
                $c['field'] = $memory[$n];
                $c['confidence'] = 'saved';
                $takenBy[$memory[$n]] = $i;
            }
        }
        unset($c);

        // 2. Meilleurs scores d'abord, un champ par colonne et une colonne par champ
        $pairs = [];
        foreach ($cols as $i => $c) {
            if ($c['field'] !== null) {
                continue;
            }
            foreach ($c['_cand'] as $f => $m) {
                if ($m['score'] >= $m['min']) {
                    $pairs[] = [$m['score'], $i, $f];
                }
            }
        }
        usort($pairs, fn ($a, $b) => $b[0] <=> $a[0]);
        foreach ($pairs as [$score, $i, $f]) {
            if ($cols[$i]['field'] !== null || isset($takenBy[$f])) {
                continue;
            }
            $m = $cols[$i]['_cand'][$f];
            $cols[$i]['field'] = $f;
            $cols[$i]['confidence'] = $score >= 0.85 ? 'high' : ($score >= 0.6 ? 'medium' : 'low');
            if ($m['contradict']) {
                $cols[$i]['note'] = 'Le contenu ne ressemble pas à ce champ : vérifiez.';
            } elseif ($m['h'] < 0.7) {
                $cols[$i]['note'] = 'Deviné d\'après le contenu : '.(self::WHY[$kinds[$f]] ?? 'du texte').'.';
            }
            $takenBy[$f] = $i;
        }

        // 3. Colonnes restantes : dire pourquoi elles sont ignorees
        foreach ($cols as $i => &$c) {
            if ($c['field'] !== null) {
                continue;
            }
            $best = null;
            $bestScore = 0.0;
            foreach ($c['_cand'] as $f => $m) {
                if ($m['score'] >= $m['min'] && $m['score'] > $bestScore && isset($takenBy[$f])) {
                    $best = $f;
                    $bestScore = $m['score'];
                }
            }
            if ($best !== null) {
                $other = $cols[$takenBy[$best]]['header'];
                $c['note'] = 'Même champ que la colonne « '.($other !== '' ? $other : '(sans titre)').' » : ignorée.';
            }
        }
        unset($c);

        return array_values(array_map(function ($c) {
            unset($c['_norm'], $c['_cand']);

            return $c;
        }, $cols));
    }

    // ---------------------------------------------------------------- types

    private static function kindOf(string $key, array $meta): string
    {
        if (! empty($meta['kind'])) {
            return (string) $meta['kind'];
        }
        $type = $meta['type'] ?? 'string';
        $k = mb_strtolower($key);

        if ($type === 'bool') {
            return 'bool';
        }
        if ($type === 'id') {
            return 'id';
        }
        if ($type === 'slug') {
            return 'slug';
        }
        if ($type === 'text') {
            return 'longtext';
        }
        if ($type === 'int') {
            if (preg_match('/price|prix|fee|frais|tarif|montant|cost|cout|amount/', $k)) {
                return 'money';
            }
            if (preg_match('/stock|quant|qty/', $k)) {
                return 'qty';
            }

            return 'int';
        }
        if ($type === 'string') {
            if (preg_match('/categor|rubrique|famille/', $k)) {
                return 'label';
            }
            if (preg_match('/image|photo|url|lien|link/', $k)) {
                return 'url';
            }
            if (preg_match('/^(name|title|label|question|titre|nom)/', $k)) {
                return 'name';
            }
        }

        return 'text';
    }

    // --------------------------------------------------------------- titres

    private static function norm(string $s): string
    {
        $s = str_replace("\xEF\xBB\xBF", '', $s);
        $s = Str::ascii(mb_strtolower($s));

        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $s));
    }

    /** @return list<string> */
    private static function tokens(string $norm): array
    {
        $out = [];
        foreach (explode(' ', $norm) as $t) {
            if ($t === '' || in_array($t, self::STOP, true) || in_array($t, self::LANG_EN, true)) {
                continue;
            }
            if (strlen($t) > 3 && str_ends_with($t, 's')) {
                $t = substr($t, 0, -1);
            }
            $out[] = $t;
        }

        return array_values(array_unique($out));
    }

    private static function sim(array $ht, array $ct): float
    {
        if ($ht === [] || $ct === []) {
            return 0.0;
        }
        if (array_diff($ht, $ct) === [] && array_diff($ct, $ht) === []) {
            return 1.0;
        }
        if (array_diff($ct, $ht) === []) {
            return count($ct) >= 2 ? 0.85 : 0.8;
        }
        if (array_diff($ht, $ct) === []) {
            return 0.75;
        }
        if (count($ht) === 1 && count($ct) === 1 && strlen($ht[0]) >= 5 && strlen($ct[0]) >= 5 && levenshtein($ht[0], $ct[0]) <= 1) {
            return 0.75;
        }

        return 0.0;
    }

    private static function headerScore(array $ht, string $key, array $meta, string $kind): float
    {
        $best = 0.0;
        foreach (array_merge([$key, (string) ($meta['label'] ?? ''), (string) ($meta['column'] ?? '')], $meta['aliases'] ?? []) as $c) {
            $best = max($best, self::sim($ht, self::tokens(self::norm((string) $c))));
        }
        foreach (self::SYN[$kind] ?? [] as $s) {
            $best = max($best, 0.85 * self::sim($ht, self::tokens(self::norm($s))));
        }

        return $best;
    }

    // -------------------------------------------------------------- contenu

    private static function str(mixed $v): string
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

    private static function toFloat(string $s): ?float
    {
        $s = (string) preg_replace('/[^0-9.,\-]/u', '', $s);
        if ($s === '' || ! preg_match('/\d/', $s)) {
            return null;
        }
        $dot = str_contains($s, '.');
        $com = str_contains($s, ',');
        if ($dot && $com) {
            $dec = strrpos($s, '.') > strrpos($s, ',') ? '.' : ',';
            $th = $dec === '.' ? ',' : '.';
            $s = str_replace($dec, '.', str_replace($th, '', $s));
        } elseif ($dot || $com) {
            $parts = explode($dot ? '.' : ',', $s);
            $last = end($parts);
            if (count($parts) > 2 || (strlen($last) === 3 && strlen($parts[0]) >= 1 && strlen($parts[0]) <= 3)) {
                $s = implode('', $parts);
            } else {
                $s = $parts[0].'.'.($parts[1] ?? '0');
            }
        }

        return is_numeric($s) ? (float) $s : null;
    }

    /** @param list<string> $vals valeurs non vides */
    private static function profile(array $vals): array
    {
        $n = max(count($vals), 1);
        $c = ['num' => 0, 'int' => 0, 'dec' => 0, 'cur' => 0, 'url' => 0, 'img' => 0, 'bool' => 0, 'slug' => 0, 'sp' => 0];
        $nums = [];
        $len = 0;
        $uniq = [];

        foreach ($vals as $v) {
            $low = mb_strtolower($v);
            $len += mb_strlen($v);
            $uniq[$low] = true;
            if (str_contains($v, ' ')) {
                $c['sp']++;
            }
            if (preg_match('/^[€$]?\s*-?[\d\s.,\x{00A0}\x{202F}]+\s*(fcfa|f cfa|xof|cfa|eur|usd|€|\$|f)?$/u', $low) && preg_match('/\d/', $low)) {
                $f = self::toFloat($low);
                if ($f !== null) {
                    $c['num']++;
                    $nums[] = $f;
                    floor($f) == $f ? $c['int']++ : $c['dec']++;
                    if (preg_match('/fcfa|f cfa|xof|cfa|eur|usd|€|\$|\d\s*f$/u', $low)) {
                        $c['cur']++;
                    }
                }
            }
            if (preg_match('#^https?://#i', $v)) {
                $c['url']++;
            }
            if (preg_match(self::IMG, $v)) {
                $c['img']++;
            }
            if (in_array(trim(Str::ascii($low)), self::BOOLS, true)) {
                $c['bool']++;
            }
            if (! is_numeric($low) && (preg_match('/^[a-z0-9]+([-_][a-z0-9]+)+$/', $low) || preg_match('/^[a-z0-9_-]*\d[a-z0-9_-]*$/', $low))) {
                $c['slug']++;
            }
        }
        sort($nums);

        return [
            'n' => count($vals),
            'num' => $c['num'] / $n, 'int' => $c['int'] / $n, 'dec' => $c['dec'] / $n, 'cur' => $c['cur'] / $n,
            'url' => $c['url'] / $n, 'img' => $c['img'] / $n, 'bool' => $c['bool'] / $n,
            'slug' => $c['slug'] / $n, 'sp' => $c['sp'] / $n,
            'avg' => $len / $n, 'uniq' => count($uniq) / $n, 'distinct' => count($uniq),
            'med' => $nums ? $nums[intdiv(count($nums), 2)] : 0.0,
            'max' => $nums ? end($nums) : 0.0,
            'min' => $nums ? $nums[0] : 0.0,
        ];
    }

    /** Compatibilite du contenu avec un type de champ : 0 (incompatible) a 1. */
    private static function contentScore(string $kind, array $p): float
    {
        $textual = $p['num'] <= 0.5 && $p['url'] <= 0.5 && $p['bool'] <= 0.9;

        switch ($kind) {
            case 'money':
                if ($p['num'] < 0.9) {
                    return 0.0;
                }
                $s = 0.45;
                if ($p['cur'] > 0.3) {
                    $s += 0.4;
                }
                $s += $p['med'] >= 100 ? 0.1 : -0.15;
                if ($p['dec'] > 0.3) {
                    $s += 0.05;
                }

                return max(0.05, min(1.0, $s));

            case 'qty':
            case 'int':
                if ($p['int'] < 0.9 || $p['max'] > 100000 || $p['min'] < 0) {
                    return 0.0;
                }
                $s = $kind === 'qty' ? 0.45 : 0.4;
                if ($p['med'] < 1000) {
                    $s += 0.1;
                }
                if ($p['cur'] > 0) {
                    $s -= 0.3;
                }

                return max(0.05, $s);

            case 'id':
                return ($p['int'] >= 1.0 && $p['uniq'] >= 0.99 && $p['cur'] == 0.0) ? 0.3 : 0.0;

            case 'bool':
                if ($p['bool'] < 0.9) {
                    return 0.0;
                }

                return $p['num'] > 0.9 ? 0.45 : 0.85;

            case 'url':
                if ($p['url'] >= 0.8 || $p['img'] >= 0.8) {
                    return 0.9;
                }

                return $p['img'] >= 0.5 ? 0.6 : 0.0;

            case 'slug':
                return ($p['slug'] >= 0.9 && $p['sp'] < 0.1) ? 0.7 : 0.0;

            case 'longtext':
                if (! $textual) {
                    return 0.0;
                }

                return $p['avg'] >= 60 ? 0.8 : ($p['avg'] >= 35 ? 0.5 : 0.1);

            case 'label':
                if (! $textual) {
                    return 0.0;
                }

                return ($p['avg'] <= 40 && $p['uniq'] <= 0.6 && $p['distinct'] >= 2) ? 0.7 : 0.15;

            case 'name':
                if (! $textual) {
                    return 0.0;
                }
                if ($p['avg'] >= 3 && $p['avg'] <= 120 && $p['uniq'] >= 0.8) {
                    return $p['avg'] > 80 ? 0.4 : 0.65;
                }

                return 0.2;

            default:
                return ($p['num'] > 0.9 || $p['url'] > 0.9) ? 0.05 : 0.3;
        }
    }
}