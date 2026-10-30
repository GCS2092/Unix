<?php

namespace App\Services\Import;

use App\Models\Setting;
use App\Models\User;
use App\Services\Import\Concerns\ParsesCells;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

final class ResourceImporter
{
    use ParsesCells;

    public const MAX_ROWS = 20000;
    public const MAX_ISSUES = 1000;
    private const SCAN_ROWS = 30;

    private array $report = [];
    private array $seen = [];

    public function __construct(private readonly SheetReader $reader)
    {
    }

    // ===================== ANALYSE (n'ecrit rien) =====================

    /** @return array<string, mixed> */
    public function analyze(ImportDefinition $def, string $path, string $ext, ?int $sheet = null, ?int $headerLine = null): array
    {
        $sheets = $this->reader->sheets($path, $ext);
        if ($sheet === null || $headerLine === null) {
            [$sheet, $headerLine] = $this->detect($def, $path, $ext, $sheets, $sheet);
        }
        [$headers, $rows, $total] = $this->load($path, $ext, $sheet, $headerLine, 40);
        $columns = $this->suggest($def, $headers, $this->columnValues($headers, $rows));

        $fields = $def->fields();
        $mapped = array_filter(array_column($columns, 'field'));
        $warnings = [];

        $ids = array_keys(array_filter($fields, fn ($m) => ! empty($m['key']) && empty($m['virtual'])));
        if (array_intersect(array_keys(array_filter($fields, fn ($m) => ! empty($m['key']))), $mapped) === []) {
            $labels = implode(', ', array_map(fn ($k) => '« '.$fields[$k]['label'].' »', $ids));
            $warnings[] = 'Aucune colonne d\'identification reconnue ('.$labels.') : choisissez-la dans la liste.';
        }
        foreach ($fields as $k => $m) {
            if (! empty($m['required']) && ! in_array($k, $mapped, true)) {
                $warnings[] = 'Aucune colonne « '.$m['label'].' » : les nouveaux éléments ne pourront pas être créés (la mise à jour reste possible).';
            }
        }
        if ($total > self::MAX_ROWS) {
            $warnings[] = 'Le fichier dépasse '.self::MAX_ROWS.' lignes : découpez-le en plusieurs fichiers.';
        }
        if (count($sheets) > 1) {
            $name = collect($sheets)->firstWhere('index', $sheet)['name'] ?? '';
            $warnings[] = 'Le fichier contient '.count($sheets).' feuilles. Feuille utilisée : « '.$name.' ».';
        }

        return [
            'sheets' => $sheets,
            'sheet' => $sheet,
            'header_line' => $headerLine,
            'total_rows' => min($total, self::MAX_ROWS + 1),
            'max_rows' => self::MAX_ROWS,
            'columns' => $columns,
            'fields' => collect($fields)->map(fn ($m, $k) => [
                'key' => $k, 'label' => $m['label'], 'identifies' => ! empty($m['key']), 'required' => ! empty($m['required']),
            ])->values()->all(),
            'warnings' => $warnings,
        ];
    }

    // ===================== IMPORT =====================

    /** @return array<string, mixed> */
    public function run(ImportDefinition $def, string $path, string $ext, bool $dryRun, ?User $admin, array $opts = []): array
    {
        $opts += ['mode' => 'both', 'mapping' => null, 'sheet' => null, 'header_line' => null, 'remember' => false];
        $mode = in_array($opts['mode'], ['both', 'create', 'update'], true) ? $opts['mode'] : 'both';
        $fields = $def->fields();

        $sheets = $this->reader->sheets($path, $ext);
        $only = $opts['sheet'] !== null ? (int) $opts['sheet'] : null;
        if ($only !== null && $opts['header_line'] !== null) {
            $sheet = $only;
            $headerLine = (int) $opts['header_line'];
        } else {
            [$sheet, $headerLine] = $this->detect($def, $path, $ext, $sheets, $only);
        }
        [$headers, $rows] = $this->load($path, $ext, $sheet, $headerLine, null);

        $warnings = [];
        $map = [];
        if (is_array($opts['mapping'])) {
            foreach ($opts['mapping'] as $i => $field) {
                $field = (string) $field;
                if ($field === '' || ! isset($fields[$field])) {
                    continue;
                }
                if (in_array($field, $map, true)) {
                    $warnings[] = 'Le champ « '.$fields[$field]['label'].' » est choisi pour plusieurs colonnes : seule la première est utilisée.';
                    continue;
                }
                $map[(int) $i] = $field;
            }
        } else {
            foreach ($this->suggest($def, $headers, $this->columnValues($headers, $rows)) as $col) {
                if ($col['field'] !== null) {
                    $map[$col['index']] = $col['field'];
                }
            }
        }

        $keyFields = array_keys(array_filter($fields, fn ($m) => ! empty($m['key'])));
        if (array_intersect($keyFields, array_values($map)) === []) {
            $labels = implode(', ', array_map(fn ($k) => '« '.$fields[$k]['label'].' »', $keyFields));
            throw new RuntimeException('Aucune colonne d\'identification associée ('.$labels.'). Vérifiez la correspondance des colonnes.');
        }

        $unknown = [];
        foreach ($headers as $i => $h) {
            $label = $this->str($h);
            if ($label !== '' && ! isset($map[$i])) {
                $unknown[] = $label;
            }
        }

        $this->seen = [];
        $this->report = [
            'dry_run' => $dryRun, 'total' => 0, 'created' => 0, 'updated' => 0, 'unchanged' => 0, 'skipped' => 0,
            'unknown_columns' => $unknown, 'issues' => [], 'preview' => [], 'rejected' => [],
            'warnings' => $warnings, 'header_line' => $headerLine,
        ];

        DB::beginTransaction();
        try {
            foreach ($rows as [$line, $cells]) {
                $data = [];
                foreach ($map as $idx => $key) {
                    $data[$key] = $cells[$idx] ?? null;
                }
                $this->report['total']++;
                try {
                    $result = DB::transaction(fn () => $this->importRow($def, $line, $data, $mode, $admin));
                } catch (Throwable $e) {
                    report($e);
                    $this->issue($def, $line, 'error', null, 'Erreur inattendue, ligne ignorée.', $data);
                    $result = 'skipped';
                }
                if ($result === 'skipped' && count($this->report['rejected']) < 500) {
                    $reason = '';
                    foreach (array_reverse($this->report['issues']) as $iss) {
                        if ($iss['row'] === $line && $iss['level'] === 'error') {
                            $reason = $iss['message'];
                            break;
                        }
                    }
                    $this->report['rejected'][] = ['row' => $line, 'reason' => $reason, 'data' => array_map(fn ($v) => $this->str($v), $data)];
                }
                $this->report[$result]++;
            }
        } finally {
            $dryRun ? DB::rollBack() : DB::commit();
        }

        if (! $dryRun && $opts['remember']) {
            $this->rememberMapping($def, $headers, $map);
        }

        return $this->report;
    }

    private function importRow(ImportDefinition $def, int $line, array $d, string $mode, ?User $admin): string
    {
        $fields = $def->fields();
        $vals = [];
        $bad = [];
        $warns = [];

        foreach ($fields as $key => $meta) {
            if (! array_key_exists($key, $d) || $this->blank($d[$key])) {
                continue;
            }
            [$v, $err, $warn] = $this->cast($meta, $d[$key]);
            if ($err !== null) {
                $bad[$key] = $err;
                continue;
            }
            $vals[$key] = $v;
            if ($warn !== null) {
                $warns[$key] = $warn;
            }
        }

        $hasKey = false;
        foreach ($fields as $k => $m) {
            if (! empty($m['key']) && isset($vals[$k])) {
                $hasKey = true;
            }
        }
        if (! $hasKey) {
            $this->issue($def, $line, 'error', null, 'Ligne sans identifiant exploitable (valeur manquante ou invalide).', $d);

            return 'skipped';
        }

        $model = $def->find($vals);
        $creating = $model === null;

        if ($creating && $mode === 'update') {
            $this->issue($def, $line, 'error', null, 'Élément introuvable : ligne ignorée (mode mise à jour seulement).', $d);

            return 'skipped';
        }
        if (! $creating && $mode === 'create') {
            $this->issue($def, $line, 'warning', null, 'Élément déjà existant : ligne ignorée (mode création seulement).', $d);

            return 'unchanged';
        }

        if ($creating) {
            foreach ($fields as $k => $m) {
                if (! empty($m['required']) && ! isset($vals[$k])) {
                    $this->issue($def, $line, 'error', $k, $bad[$k] ?? 'Champ « '.$m['label'].' » manquant.', $d);

                    return 'skipped';
                }
            }
        }
        foreach ($bad as $k => $msg) {
            $this->issue($def, $line, 'warning', $k, $msg.' Valeur ignorée.', $d);
        }
        foreach ($warns as $k => $msg) {
            $this->issue($def, $line, 'warning', $k, $msg, $d);
        }

        $immutable = $def->immutable();
        $attrs = [];
        foreach ($vals as $k => $v) {
            if (! empty($fields[$k]['virtual'])) {
                continue;
            }
            if (! $creating && in_array($k, $immutable, true)) {
                continue;
            }
            $attrs[$k] = $v;
        }
        $attrs = $def->resolve($vals, $attrs, $creating, fn (string $f, string $m) => $this->issue($def, $line, 'warning', $f, $m, $d));

        $label = $this->labelOf($def, $d);

        if ($creating) {
            $model = $def->create($attrs, $admin);
            $this->seen[$model->getKey()] = $line;
            $this->preview($line, 'create', $label);

            return 'created';
        }

        if (isset($this->seen[$model->getKey()])) {
            $this->issue($def, $line, 'warning', null, 'Doublon dans le fichier (déjà vu ligne '.$this->seen[$model->getKey()].') : cette ligne s\'applique par-dessus.', $d);
        }
        $model->fill($attrs);
        $changed = $model->isDirty();
        if ($changed) {
            $model->save();
        }
        $this->seen[$model->getKey()] = $line;
        $this->preview($line, $changed ? 'update' : 'unchanged', $label);

        return $changed ? 'updated' : 'unchanged';
    }

    /** @return array{0:mixed,1:?string,2:?string} valeur, erreur, avertissement */
    private function cast(array $meta, mixed $raw): array
    {
        $type = $meta['type'] ?? 'string';
        $label = $meta['label'];
        $shown = Str::limit($this->str($raw), 30);
        $invalid = "Valeur invalide pour « $label » (« $shown »).";

        switch ($type) {
            case 'int':
            case 'id':
                $n = $this->parseInt($raw);
                $min = $meta['min'] ?? ($type === 'id' ? 1 : 0);
                $max = $meta['max'] ?? 2000000000;
                if ($n === null || $n < $min || $n > $max) {
                    return [null, $invalid, null];
                }

                return [$n, null, null];

            case 'bool':
                $b = $this->parseBool($this->str($raw));

                return $b === null ? [null, $invalid.' Attendu : oui ou non.', null] : [$b, null, null];

            case 'enum':
                $map = [];
                foreach ($meta['values'] ?? [] as $val) {
                    $map[$this->norm((string) $val)] = $val;
                }
                $k = $this->norm($this->str($raw));

                return isset($map[$k]) ? [$map[$k], null, null] : [null, $invalid.' Valeurs : '.implode(', ', $meta['values'] ?? []).'.', null];

            case 'slug':
                $s = Str::slug($this->str($raw), $meta['separator'] ?? '-');
                if ($s === '') {
                    return [null, $invalid, null];
                }
                $max = $meta['max'] ?? 255;
                if (mb_strlen($s) > $max) {
                    return [mb_substr($s, 0, $max), null, "« $label » tronqué à $max caractères."];
                }

                return [$s, null, null];

            default:
                $s = $this->str($raw);
                $max = $meta['max'] ?? ($type === 'text' ? 65000 : 255);
                if (mb_strlen($s) > $max) {
                    return [mb_substr($s, 0, $max), null, "« $label » tronqué à $max caractères."];
                }

                return [$s, null, null];
        }
    }

    // ===================== LECTURE & DETECTION =====================

    /** @return array{0:int,1:int} */
    private function detect(ImportDefinition $def, string $path, string $ext, array $sheets, ?int $only): array
    {
        $best = null;
        foreach ($sheets as $s) {
            if ($only !== null && $s['index'] !== $only) {
                continue;
            }
            $seen = 0;
            $it = $this->reader->rows($path, $ext, $s['index']);
            foreach ($it as $line => $cells) {
                if ($this->blankRow($cells)) {
                    if ($line > 200) {
                        break;
                    }
                    continue;
                }
                $score = $this->headerScore($def, $cells);
                if ($best === null || $score > $best['score']) {
                    $best = ['sheet' => $s['index'], 'line' => $line, 'score' => $score];
                }
                if (++$seen >= self::SCAN_ROWS) {
                    break;
                }
            }
            unset($it);
        }
        if ($best === null) {
            throw new RuntimeException($only !== null ? 'Feuille introuvable ou vide.' : 'Fichier vide.');
        }

        return [$best['sheet'], $best['line']];
    }

    /** @return array{0: array<int,mixed>, 1: array<int, array{0:int,1:array}>, 2: int} */
    private function load(string $path, string $ext, int $sheet, int $headerLine, ?int $keep): array
    {
        $headers = [];
        $rows = [];
        $total = 0;
        $it = $this->reader->rows($path, $ext, $sheet);
        foreach ($it as $line => $cells) {
            if ($line < $headerLine) {
                continue;
            }
            if ($line === $headerLine) {
                $headers = $cells;
                continue;
            }
            if ($this->blankRow($cells)) {
                continue;
            }
            $total++;
            if ($keep === null) {
                if ($total > self::MAX_ROWS) {
                    throw new RuntimeException('Fichier trop gros : maximum '.self::MAX_ROWS.' lignes par import. Découpez-le en plusieurs fichiers.');
                }
                $rows[] = [$line, $cells];
            } else {
                if (count($rows) < $keep) {
                    $rows[] = [$line, $cells];
                }
                if ($total > self::MAX_ROWS) {
                    break;
                }
            }
        }
        unset($it);

        if ($headers === [] || $this->blankRow($headers)) {
            throw new RuntimeException('La ligne des titres est vide : indiquez la bonne ligne.');
        }

        return [$headers, $rows, $total];
    }

    private function columnValues(array $headers, array $rows, int $max = 40): array
    {
        $out = [];
        foreach ($headers as $i => $_) {
            $out[$i] = [];
        }
        foreach (array_slice($rows, 0, $max) as [$line, $cells]) {
            foreach ($headers as $i => $_) {
                $out[$i][] = $cells[$i] ?? null;
            }
        }

        return $out;
    }

    // ===================== CORRESPONDANCE DES COLONNES =====================

    private function headerScore(ImportDefinition $def, array $cells): int
    {
        $found = [];
        $filled = 0;
        foreach ($cells as $h) {
            $n = $this->norm($this->str($h));
            if ($n === '') {
                continue;
            }
            $filled++;
            $m = $this->matchHeader($def, $n);
            if ($m !== null) {
                $found[$m[0]] = true;
            }
        }
        if ($filled < 2) {
            return 0;
        }
        $score = count($found);
        foreach ($def->fields() as $k => $meta) {
            if (isset($found[$k]) && (! empty($meta['key']) || ! empty($meta['required']))) {
                $score += 2;
                break;
            }
        }

        return $score;
    }

    /** @return array{0:string,1:float}|null champ, score (1 = exact) */
    private function matchHeader(ImportDefinition $def, string $n): ?array
    {
        if ($n === '') {
            return null;
        }
        $best = null;
        foreach ($def->fields() as $key => $meta) {
            foreach (array_merge([$key, $meta['label'], $meta['column'] ?? ''], $meta['aliases'] ?? []) as $cand) {
                $cn = $this->norm((string) $cand);
                if ($cn === '') {
                    continue;
                }
                $s = $this->similarity($n, $cn);
                if ($s > ($best[1] ?? 0.0)) {
                    $best = [$key, $s];
                }
            }
        }

        return ($best !== null && $best[1] >= 0.7) ? $best : null;
    }

    private function tokens(string $n): array
    {
        return array_values(array_filter(array_map(
            fn ($t) => (strlen($t) > 3 && str_ends_with($t, 's')) ? substr($t, 0, -1) : $t,
            explode(' ', $n)
        )));
    }

    private function similarity(string $a, string $b): float
    {
        if ($a === $b) {
            return 1.0;
        }
        $ta = $this->tokens($a);
        $tb = $this->tokens($b);
        if ($ta === [] || $tb === []) {
            return 0.0;
        }
        if ($ta === $tb) {
            return 0.97;
        }
        [$small, $large] = count($ta) <= count($tb) ? [$ta, $tb] : [$tb, $ta];
        if (array_diff($small, $large) === []) {
            $ratio = count($small) / count($large);
            if ($ratio >= 0.5) {
                return 0.6 + 0.35 * $ratio;
            }
        }
        if (strlen($a) >= 5 && strlen($b) >= 5) {
            $d = levenshtein($a, $b);
            if ($d <= 1) {
                return 0.75;
            }
            if ($d <= 2 && min(strlen($a), strlen($b)) >= 8) {
                return 0.7;
            }
        }

        return 0.0;
    }

    /** @return array<int, array<string, mixed>> */
    private function suggest(ImportDefinition $def, array $headers, array $values): array
    {
        $memory = $this->loadMemory($def);
        // Moteur commun : titre + contenu des colonnes (le code ci-dessous est conserve mais n'est plus atteint)
        return ColumnMatcher::suggest($headers, $values, $def->fields(), $memory);
        $fields = $def->fields();
        $cols = [];

        foreach ($headers as $i => $raw) {
            $header = $this->str($raw);
            $filled = array_values(array_filter(
                array_map(fn ($v) => $this->str($v), $values[$i] ?? []),
                fn ($v) => $v !== ''
            ));
            if ($header === '' && $filled === []) {
                continue;
            }
            $n = $this->norm($header);
            $cand = null;
            $score = 0.0;
            $conf = 'none';
            if ($n !== '' && isset($memory[$n]) && isset($fields[$memory[$n]])) {
                $cand = $memory[$n];
                $score = 2.0;
                $conf = 'saved';
            } elseif (($m = $this->matchHeader($def, $n)) !== null) {
                [$cand, $score] = $m;
                $conf = $score >= 1.0 ? 'high' : 'medium';
            }
            $cols[$i] = [
                'index' => (int) $i,
                'header' => $header,
                'samples' => array_slice(array_values(array_unique($filled)), 0, 3),
                'field' => null,
                'confidence' => 'none',
                'note' => null,
                '_cand' => $cand, '_score' => $score, '_conf' => $conf, '_vals' => $filled,
            ];
        }

        $order = array_keys($cols);
        usort($order, fn ($a, $b) => $cols[$b]['_score'] <=> $cols[$a]['_score']);

        $taken = [];
        foreach ($order as $i) {
            if ($cols[$i]['_cand'] === null) {
                continue;
            }
            $f = $cols[$i]['_cand'];
            if (isset($taken[$f])) {
                $cols[$i]['note'] = 'Même champ que la colonne « '.$taken[$f].' » : ignorée.';
                continue;
            }
            $taken[$f] = $cols[$i]['header'] !== '' ? $cols[$i]['header'] : '(sans titre)';
            $cols[$i]['field'] = $f;
            $cols[$i]['confidence'] = $cols[$i]['_conf'];
        }

        foreach (array_keys($cols) as $i) {
            if ($cols[$i]['field'] !== null || $cols[$i]['note'] !== null) {
                continue;
            }
            $g = $this->guessByContent($fields, $cols[$i]['_vals'], $taken);
            if ($g !== null) {
                $taken[$g] = $cols[$i]['header'] !== '' ? $cols[$i]['header'] : '(sans titre)';
                $cols[$i]['field'] = $g;
                $cols[$i]['confidence'] = 'low';
            }
        }

        return array_values(array_map(function ($c) {
            unset($c['_cand'], $c['_score'], $c['_conf'], $c['_vals']);

            return $c;
        }, $cols));
    }

    /** Devine d'apres le contenu quand le titre ne dit rien (une seule candidature possible). */
    private function guessByContent(array $fields, array $vals, array $taken): ?string
    {
        if (count($vals) < 2) {
            return null;
        }
        $all = fn (callable $fn) => count(array_filter($vals, $fn)) === count($vals);
        $free = fn (string $type) => array_values(array_keys(array_filter(
            $fields,
            fn ($m, $k) => ($m['type'] ?? 'string') === $type && ! isset($taken[$k]) && empty($m['virtual']),
            ARRAY_FILTER_USE_BOTH
        )));

        if ($all(fn ($v) => ! is_numeric($v) && $this->parseBool($v) !== null)) {
            $c = $free('bool');
            if (count($c) === 1) {
                return $c[0];
            }
        }
        if ($all(fn ($v) => preg_match('/^\d+$/', $v) === 1)) {
            $c = $free('int');
            if (count($c) === 1) {
                return $c[0];
            }
        }

        return null;
    }

    // ===================== MEMOIRE DES CORRESPONDANCES =====================

    private function memoryKey(ImportDefinition $def): string
    {
        return 'import.header_map.'.$def->key();
    }

    /** @return array<string, string> */
    private function loadMemory(ImportDefinition $def): array
    {
        try {
            $a = json_decode((string) Setting::query()->where('key', $this->memoryKey($def))->value('value'), true);

            return is_array($a) ? $a : [];
        } catch (Throwable) {
            return [];
        }
    }

    private function rememberMapping(ImportDefinition $def, array $headers, array $map): void
    {
        try {
            $mem = $this->loadMemory($def);
            foreach ($map as $i => $field) {
                $n = $this->norm($this->str($headers[$i] ?? ''));
                if ($n !== '') {
                    unset($mem[$n]);
                    $mem[$n] = $field;
                }
            }
            $mem = array_slice($mem, -200, null, true);
            Setting::query()->updateOrCreate(['key' => $this->memoryKey($def)], ['value' => json_encode($mem, JSON_UNESCAPED_UNICODE)]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    // ===================== RAPPORT =====================

    private function labelOf(ImportDefinition $def, array $d): string
    {
        foreach ($def->fields() as $k => $m) {
            if (! empty($m['key']) && empty($m['virtual']) && ! $this->blank($d[$k] ?? null)) {
                return Str::limit($this->str($d[$k]), 60);
            }
        }

        return '';
    }

    private function preview(int $line, string $action, string $label): void
    {
        if (count($this->report['preview']) < 100) {
            $this->report['preview'][] = ['row' => $line, 'action' => $action, 'label' => $label];
        }
    }

    private function issue(ImportDefinition $def, int $line, string $level, ?string $field, string $message, array $data = []): void
    {
        if (count($this->report['issues']) >= self::MAX_ISSUES) {
            $this->report['issues_truncated'] = true;

            return;
        }
        $this->report['issues'][] = [
            'row' => $line, 'level' => $level, 'field' => $field, 'message' => $message,
            'name' => $this->labelOf($def, $data),
        ];
    }
}