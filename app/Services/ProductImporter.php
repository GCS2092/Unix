<?php

namespace App\Services;

use App\Enums\StockMovementReason;
use App\Models\Category;
use App\Models\Product;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use OpenSpout\Reader\CSV\Options as CsvOptions;
use OpenSpout\Reader\CSV\Reader as CsvReader;
use OpenSpout\Reader\XLSX\Options as XlsxOptions;
use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use Throwable;

class ProductImporter
{
    public const MAX_ROWS = 2000;
    public const MAX_ISSUES = 1000;
    private const SCAN_ROWS = 30;
    private const MEMORY_KEY = 'import.header_map';

    public const FIELDS = [
        'name' => 'Nom',
        'price' => 'Prix',
        'stock' => 'Stock',
        'slug' => 'Slug / référence',
        'category' => 'Catégorie',
        'description' => 'Description',
        'name_en' => 'Nom (anglais)',
        'description_en' => 'Description (anglais)',
        'published' => 'Publié (oui/non)',
        'image_link' => 'Lien image',
    ];

    private const ALIASES = [
        'name' => ['name', 'nom', 'produit', 'nom du produit', 'designation', 'libelle', 'titre', 'product'],
        'price' => ['price', 'prix', 'prix fcfa', 'prix unitaire', 'tarif', 'montant'],
        'stock' => ['stock', 'quantite', 'qte', 'qty', 'quantity', 'inventaire'],
        'slug' => ['slug', 'sku', 'reference', 'ref', 'code'],
        'category' => ['category', 'categorie', 'cat', 'rayon', 'famille'],
        'description' => ['description', 'desc', 'details', 'detail'],
        'name_en' => ['name en', 'nom en', 'name english', 'nom anglais', 'english name'],
        'description_en' => ['description en', 'desc en', 'english description', 'description anglais'],
        'published' => ['published', 'publie', 'en ligne', 'visible', 'statut', 'actif'],
        'image_link' => ['image link', 'image', 'lien image', 'url image', 'photo', 'image url'],
    ];

    private array $report = [];
    private array $categories = [];
    private array $opts = [];

    // =====================================================================
    //  ANALYSE (sans rien ecrire) : feuille, ligne de titres, colonnes
    // =====================================================================

    /** @return array<string, mixed> */
    public function analyze(string $path, string $ext, ?int $sheet = null, ?int $headerLine = null): array
    {
        if ($sheet !== null && $headerLine !== null) {
            $sheetIdx = $sheet;
            $line = $headerLine;
            $sheets = $this->detect($path, $ext, $sheet)[2];
        } else {
            [$sheetIdx, $line, $sheets] = $this->detect($path, $ext, $sheet);
        }

        [$headers, $rows, $total] = $this->readSheet($path, $ext, $sheetIdx, $line, 40);
        $columns = $this->suggest($headers, $this->columnValues($headers, $rows));

        $warnings = [];
        $mapped = array_filter(array_column($columns, 'field'));
        if (! in_array('name', $mapped, true) && ! in_array('slug', $mapped, true)) {
            $warnings[] = 'Aucune colonne « nom » reconnue : choisissez-la dans la liste ci-dessous.';
        }
        if (! in_array('price', $mapped, true)) {
            $warnings[] = 'Aucune colonne « prix » : les nouveaux produits ne pourront pas être créés (la mise à jour reste possible).';
        }
        if ($total > self::MAX_ROWS) {
            $warnings[] = 'Le fichier dépasse '.self::MAX_ROWS.' lignes : découpez-le en plusieurs fichiers.';
        }
        if (in_array($ext, ['xlsx'], true) && $this->hasMergedCells($path, $sheetIdx)) {
            $warnings[] = 'Des cellules fusionnées ont été détectées : seule la première ligne d\'un bloc fusionné contient la valeur, les autres paraîtront vides.';
        }
        if (count($sheets) > 1) {
            $name = collect($sheets)->firstWhere('index', $sheetIdx)['name'] ?? '';
            $warnings[] = 'Le fichier contient '.count($sheets).' feuilles. Feuille utilisée : « '.$name.' ».';
        }

        return [
            'sheets' => $sheets,
            'sheet' => $sheetIdx,
            'header_line' => $line,
            'total_rows' => min($total, self::MAX_ROWS + 1),
            'max_rows' => self::MAX_ROWS,
            'columns' => $columns,
            'fields' => collect(self::FIELDS)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all(),
            'warnings' => $warnings,
        ];
    }

    // =====================================================================
    //  IMPORT
    // =====================================================================

    /** @return array<string, mixed> */
    public function run(string $path, string $ext, bool $dryRun, bool $publishDefault, ?User $admin, array $opts = []): array
    {
        $this->opts = $opts + [
            'mode' => 'both', 'keep_stock' => false, 'create_categories' => false,
            'mapping' => null, 'sheet' => null, 'header_line' => null, 'remember' => false,
        ];

        if ($this->opts['sheet'] !== null && $this->opts['header_line'] !== null) {
            $sheetIdx = (int) $this->opts['sheet'];
            $headerLine = (int) $this->opts['header_line'];
        } else {
            [$sheetIdx, $headerLine] = $this->detect($path, $ext, $this->opts['sheet'] !== null ? (int) $this->opts['sheet'] : null);
        }

        [$headers, $rows] = $this->readSheet($path, $ext, $sheetIdx, $headerLine, null);

        $warnings = [];
        $map = [];
        if (is_array($this->opts['mapping'])) {
            foreach ($this->opts['mapping'] as $i => $field) {
                $field = (string) $field;
                if ($field === '' || ! isset(self::FIELDS[$field])) {
                    continue;
                }
                if (in_array($field, $map, true)) {
                    $warnings[] = 'Le champ « '.self::FIELDS[$field].' » est choisi pour plusieurs colonnes : seule la première est utilisée.';
                    continue;
                }
                $map[(int) $i] = $field;
            }
        } else {
            foreach ($this->suggest($headers, $this->columnValues($headers, $rows)) as $col) {
                if ($col['field'] !== null) {
                    $map[$col['index']] = $col['field'];
                }
            }
        }

        if (! in_array('name', $map, true) && ! in_array('slug', $map, true)) {
            throw new \RuntimeException('Aucune colonne « nom » associée. Vérifiez la correspondance des colonnes avant d\'importer.');
        }

        $unknown = [];
        foreach ($headers as $i => $h) {
            $label = $this->str($h);
            if ($label !== '' && ! isset($map[$i])) {
                $unknown[] = $label;
            }
        }

        $this->report = [
            'dry_run' => $dryRun, 'total' => 0, 'created' => 0, 'updated' => 0,
            'unchanged' => 0, 'skipped' => 0, 'unknown_columns' => $unknown,
            'issues' => [], 'preview' => [], 'rejected' => [], 'warnings' => $warnings,
            'header_line' => $headerLine,
        ];

        $this->categories = [];
        foreach (Category::query()->get() as $c) {
            $k1 = $this->norm((string) $c->name);
            $k2 = $this->norm((string) $c->slug);
            if ($k1 !== '') {
                $this->categories[$k1] = $c->id;
            }
            if ($k2 !== '') {
                $this->categories[$k2] = $c->id;
            }
        }

        $seen = [];
        DB::beginTransaction();
        try {
            foreach ($rows as [$line, $cells]) {
                $data = [];
                foreach ($map as $idx => $key) {
                    $data[$key] = $cells[$idx] ?? null;
                }
                $this->report['total']++;
                try {
                    $result = DB::transaction(fn () => $this->importRow($line, $data, $publishDefault, $admin, $seen));
                } catch (Throwable $e) {
                    report($e);
                    $this->issue($line, 'error', null, 'Erreur inattendue, ligne ignoree.', $data);
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

        if (! $dryRun && $this->opts['remember']) {
            $this->rememberMapping($headers, $map);
        }

        return $this->report;
    }

    private function importRow(int $line, array $d, bool $publishDefault, ?User $admin, array &$seen): string
    {
        $name = $this->str($d['name'] ?? null);
        $slugKey = $this->str($d['slug'] ?? null);
        $slugKey = $slugKey !== '' ? Str::slug($slugKey) : '';

        if ($name === '' && $slugKey === '') {
            $this->issue($line, 'error', 'name', 'Nom du produit manquant.', $d);

            return 'skipped';
        }

        $product = null;
        if ($slugKey !== '') {
            $product = Product::query()->without('images')->where('slug', $slugKey)->first();
        }
        if ($product === null && $name !== '') {
            $product = Product::query()->without('images')->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();
        }
        $creating = $product === null;

        if ($creating && $this->opts['mode'] === 'update') {
            $this->issue($line, 'error', null, 'Produit introuvable : ligne ignoree (mode mise a jour seulement).', $d);

            return 'skipped';
        }
        if (! $creating && $this->opts['mode'] === 'create') {
            $this->issue($line, 'warning', null, 'Produit deja existant : ligne ignoree (mode creation seulement).', $d);

            return 'unchanged';
        }

        if ($creating && $name === '') {
            $this->issue($line, 'error', 'name', 'Aucun produit avec ce slug et aucun nom fourni.', $d);

            return 'skipped';
        }
        if (mb_strlen($name) > 255) {
            $name = mb_substr($name, 0, 255);
            $this->issue($line, 'warning', 'name', 'Nom tronque a 255 caracteres.', $d);
        }
        if (! $creating && isset($seen[$product->id])) {
            $this->issue($line, 'warning', 'name', 'Doublon dans le fichier (deja vu ligne '.$seen[$product->id].') : cette ligne s applique par-dessus.', $d);
        }

        $attrs = [];

        // Prix
        if (! $this->blank($d['price'] ?? null)) {
            $p = $this->parseInt($d['price']);
            if ($p === null || $p < ($creating ? 1 : 0) || $p > 2000000000) {
                if ($creating) {
                    $this->issue($line, 'error', 'price', 'Prix invalide ("'.Str::limit($this->str($d['price']), 30).'").', $d);

                    return 'skipped';
                }
                $this->issue($line, 'warning', 'price', 'Prix invalide, ancien prix conserve.', $d);
            } else {
                $attrs['price'] = $p;
            }
        } elseif ($creating) {
            $this->issue($line, 'error', 'price', 'Prix manquant.', $d);

            return 'skipped';
        }

        // Stock
        $stock = null;
        if (! $this->blank($d['stock'] ?? null)) {
            $s = $this->parseInt($d['stock'], true);
            if ($s === null || $s < 0 || $s > 10000000) {
                $this->issue($line, 'warning', 'stock', 'Stock invalide ("'.Str::limit($this->str($d['stock']), 30).'"), ignore.', $d);
            } else {
                $stock = $s;
            }
        }

        // Champs texte
        foreach (['name_en' => 255, 'description' => 65000, 'description_en' => 65000] as $f => $max) {
            $v = $this->str($d[$f] ?? null);
            if ($v !== '') {
                $attrs[$f] = mb_substr($v, 0, $max);
            }
        }

        // Categorie (comparaison sans casse ni accents)
        $cat = $this->str($d['category'] ?? null);
        if ($cat !== '') {
            $key = $this->norm($cat);
            $id = $key !== '' ? ($this->categories[$key] ?? null) : null;
            if ($id === null) {
                if ($this->opts['create_categories'] && $key !== '') {
                    $catName = Str::limit($cat, 100, '');
                    $catSlug = Str::slug($catName) ?: 'categorie';
                    if (Category::query()->where('slug', $catSlug)->exists()) {
                        $catSlug .= '-'.Str::lower(Str::random(4));
                    }
                    $newCat = Category::query()->create(['name' => $catName, 'slug' => $catSlug, 'position' => 0, 'is_active' => true]);
                    $this->categories[$key] = $newCat->id;
                    $attrs['category_id'] = $newCat->id;
                    $this->issue($line, 'warning', 'category', 'Categorie creee : "'.$catName.'".', $d);
                } else {
                    $this->issue($line, 'warning', 'category', 'Categorie inconnue ("'.Str::limit($cat, 40).'"), ignoree.', $d);
                }
            } else {
                $attrs['category_id'] = $id;
            }
        }

        // Publication
        if (! $this->blank($d['published'] ?? null)) {
            $b = $this->parseBool($this->str($d['published']));
            if ($b === null) {
                $this->issue($line, 'warning', 'published', 'Valeur de publication illisible (attendu oui/non), ignoree.', $d);
            } else {
                $attrs['is_published'] = $b;
            }
        }

        // Lien image
        $img = $this->str($d['image_link'] ?? null);
        if ($img !== '') {
            if (filter_var($img, FILTER_VALIDATE_URL) && preg_match('#^https?://#i', $img) && mb_strlen($img) <= 2048) {
                $attrs['image_link'] = $img;
            } else {
                $this->issue($line, 'warning', 'image_link', 'Lien image invalide (http/https attendu), ignore.', $d);
            }
        }

        $stockService = app(StockService::class);

        if ($creating) {
            $slug = $slugKey !== '' ? $slugKey : Str::slug($name);
            if ($slug === '') {
                $slug = 'produit';
            }
            if (Product::query()->without('images')->where('slug', $slug)->exists()) {
                $slug .= '-'.Str::lower(Str::random(5));
            }
            $product = Product::query()->create(array_merge(
                ['name' => $name, 'slug' => $slug, 'stock' => 0, 'is_published' => $publishDefault],
                $attrs,
            ));
            if (($stock ?? 0) > 0) {
                $stockService->adjust($product, $stock, StockMovementReason::Initial, $admin, 'Import Excel');
            }
            $seen[$product->id] = $line;
            $this->preview($line, 'create', $name, $attrs['price'] ?? null, $stock ?? 0);

            return 'created';
        }

        if ($name !== '' && $slugKey !== '') {
            $attrs['name'] = $name;
        }
        $product->fill($attrs);
        $changed = $product->isDirty();
        if ($changed) {
            $product->save();
        }
        $stockChanged = false;
        if (! $this->opts['keep_stock'] && $stock !== null && $stock !== (int) $product->stock) {
            $stockService->setTo($product, $stock, StockMovementReason::Inventory, $admin, 'Import Excel');
            $stockChanged = true;
        }
        $seen[$product->id] = $line;

        $action = ($changed || $stockChanged) ? 'update' : 'unchanged';
        $this->preview($line, $action, $product->name, $attrs['price'] ?? (int) $product->price, $stock ?? (int) $product->stock);

        return $action === 'update' ? 'updated' : 'unchanged';
    }

    // =====================================================================
    //  LECTURE DU FICHIER
    // =====================================================================

    private function makeReader(string $path, string $ext): object
    {
        if (in_array($ext, ['csv', 'txt'], true)) {
            $head = (string) file_get_contents($path, false, null, 0, 65536);
            $lines = array_slice((array) preg_split('/\r\n|\r|\n/', $head), 0, 10);
            $sample = implode("\n", $lines);
            $delims = [';' => substr_count($sample, ';'), ',' => substr_count($sample, ','), "\t" => substr_count($sample, "\t")];
            arsort($delims);
            $delimiter = (string) array_key_first($delims);
            $chunk = strlen($head) >= 65536 ? substr($head, 0, (int) strrpos($head, "\n")) : $head;
            $encoding = ($chunk !== '' && ! mb_check_encoding($chunk, 'UTF-8')) ? 'Windows-1252' : 'UTF-8';

            return new CsvReader(new CsvOptions(FIELD_DELIMITER: $delimiter, ENCODING: $encoding));
        }

        return new XlsxReader(new XlsxOptions(SHOULD_PRESERVE_EMPTY_ROWS: true));
    }

    /**
     * Cherche la feuille et la ligne de titres les plus probables.
     *
     * @return array{0: int, 1: int, 2: array<int, array{index:int,name:string}>}
     */
    private function detect(string $path, string $ext, ?int $only = null): array
    {
        $reader = $this->makeReader($path, $ext);
        $best = null;
        $sheets = [];

        try {
            $reader->open($path);
            foreach ($reader->getSheetIterator() as $sheet) {
                $idx = $sheet->getIndex();
                $sheets[] = ['index' => $idx, 'name' => $sheet->getName()];
                if ($only !== null && $idx !== $only) {
                    continue;
                }
                $line = 0;
                $seen = 0;
                foreach ($sheet->getRowIterator() as $row) {
                    $line++;
                    $cells = $row->toArray();
                    if ($this->blankRow($cells)) {
                        if ($line > 200) {
                            break;
                        }
                        continue;
                    }
                    $score = $this->headerScore($cells);
                    if ($best === null || $score > $best['score']) {
                        $best = ['sheet' => $idx, 'line' => $line, 'score' => $score];
                    }
                    if (++$seen >= self::SCAN_ROWS) {
                        break;
                    }
                }
            }
        } catch (Throwable $e) {
            throw new \RuntimeException('Fichier illisible ou corrompu. Reenregistrez-le en .xlsx ou .csv puis reessayez.');
        } finally {
            try {
                $reader->close();
            } catch (Throwable) {
            }
        }

        if ($best === null) {
            throw new \RuntimeException($only !== null ? 'Feuille introuvable ou vide.' : 'Fichier vide.');
        }

        return [$best['sheet'], $best['line'], $sheets];
    }

    /**
     * Lit une feuille a partir de la ligne de titres.
     * $keep = null : tout lire (erreur si trop de lignes). Sinon : garder $keep lignes et compter le reste.
     *
     * @return array{0: array<int,mixed>, 1: array<int, array{0:int,1:array}>, 2: int}
     */
    private function readSheet(string $path, string $ext, int $sheetIndex, int $headerLine, ?int $keep): array
    {
        $reader = $this->makeReader($path, $ext);
        $headers = [];
        $rows = [];
        $total = 0;
        $found = false;

        try {
            $reader->open($path);
            foreach ($reader->getSheetIterator() as $sheet) {
                if ($sheet->getIndex() !== $sheetIndex) {
                    continue;
                }
                $found = true;
                $line = 0;
                foreach ($sheet->getRowIterator() as $row) {
                    $line++;
                    if ($line < $headerLine) {
                        continue;
                    }
                    $cells = $row->toArray();
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
                            throw new \RuntimeException('Fichier trop gros : maximum '.self::MAX_ROWS.' lignes par import. Decoupez-le en plusieurs fichiers.');
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
                break;
            }
        } catch (\RuntimeException $e) {
            throw $e;
        } catch (Throwable $e) {
            throw new \RuntimeException('Fichier illisible ou corrompu. Reenregistrez-le en .xlsx ou .csv puis reessayez.');
        } finally {
            try {
                $reader->close();
            } catch (Throwable) {
            }
        }

        if (! $found) {
            throw new \RuntimeException('Feuille introuvable.');
        }
        if ($headers === [] || $this->blankRow($headers)) {
            throw new \RuntimeException('La ligne des titres est vide : indiquez la bonne ligne.');
        }

        return [$headers, $rows, $total];
    }

    private function hasMergedCells(string $path, int $sheetIndex): bool
    {
        if (! class_exists(\ZipArchive::class)) {
            return false;
        }
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return false;
        }
        try {
            $name = 'xl/worksheets/sheet'.($sheetIndex + 1).'.xml';
            $st = $zip->statName($name);
            if ($st === false || $st['size'] > 40 * 1024 * 1024) {
                return false;
            }
            $xml = $zip->getFromName($name);

            return is_string($xml) && str_contains($xml, '<mergeCell ');
        } finally {
            $zip->close();
        }
    }

    // =====================================================================
    //  RECONNAISSANCE DES COLONNES
    // =====================================================================

    /** @return array<int, array<int, mixed>> index de colonne => valeurs (40 premieres lignes) */
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

    /** @return array<int, array<string, mixed>> */
    private function suggest(array $headers, array $values): array
    {
        $memory = $this->loadMemory();
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
            $conf = 'none';
            if ($n !== '' && isset($memory[$n]) && isset(self::FIELDS[$memory[$n]])) {
                $cand = $memory[$n];
                $conf = 'saved';
            } elseif ($n !== '' && ($k = $this->canonical($n)) !== null) {
                $cand = $k;
                $conf = 'high';
            } elseif ($n !== '' && ($k = $this->guessField($n)) !== null) {
                $cand = $k;
                $conf = 'medium';
            }
            $cols[$i] = [
                'index' => (int) $i,
                'header' => $header,
                'samples' => array_slice(array_values(array_unique($filled)), 0, 3),
                'field' => null,
                'confidence' => 'none',
                'note' => null,
                '_cand' => $cand,
                '_conf' => $conf,
                '_vals' => $filled,
            ];
        }

        $taken = [];
        foreach (['saved', 'high', 'medium'] as $rank) {
            foreach (array_keys($cols) as $i) {
                if ($cols[$i]['_conf'] !== $rank || $cols[$i]['_cand'] === null) {
                    continue;
                }
                $f = $cols[$i]['_cand'];
                if (isset($taken[$f])) {
                    $cols[$i]['note'] = 'Même champ que la colonne « '.$taken[$f].' » : ignorée.';
                    continue;
                }
                $taken[$f] = $cols[$i]['header'] !== '' ? $cols[$i]['header'] : '(sans titre)';
                $cols[$i]['field'] = $f;
                $cols[$i]['confidence'] = $rank;
            }
        }

        foreach (array_keys($cols) as $i) {
            if ($cols[$i]['field'] !== null || $cols[$i]['note'] !== null) {
                continue;
            }
            $g = $this->guessByContent($cols[$i]['_vals'], $taken);
            if ($g !== null) {
                $taken[$g] = $cols[$i]['header'] !== '' ? $cols[$i]['header'] : '(sans titre)';
                $cols[$i]['field'] = $g;
                $cols[$i]['confidence'] = 'low';
            }
        }

        return array_values(array_map(function ($c) {
            unset($c['_cand'], $c['_conf'], $c['_vals']);

            return $c;
        }, $cols));
    }

    private function canonical(string $n): ?string
    {
        foreach (self::ALIASES as $key => $aliases) {
            if (in_array($n, $aliases, true)) {
                return $key;
            }
        }

        return null;
    }

    private function guessField(string $norm, bool $fuzzy = true): ?string
    {
        $tokens = array_values(array_filter(explode(' ', $norm)));
        if ($tokens === []) {
            return null;
        }
        $has = fn (array $words) => $this->hasToken($tokens, $words, $fuzzy);
        $en = $has(['en', 'english', 'anglais', 'eng']);

        if ($has(['description', 'desc', 'details', 'detail', 'descriptif'])) {
            return $en ? 'description_en' : 'description';
        }
        if ($en && $has(['nom', 'name', 'produit', 'product', 'titre', 'designation', 'libelle', 'article'])) {
            return 'name_en';
        }
        if ($has(['prix', 'price', 'tarif', 'montant', 'pu', 'pvp', 'ttc', 'ht'])) {
            return 'price';
        }
        if ($has(['stock', 'quantite', 'qte', 'qty', 'quantity', 'inventaire', 'dispo', 'disponible', 'disponibilite'])) {
            return 'stock';
        }
        if ($has(['categorie', 'category', 'cat', 'rayon', 'famille'])) {
            return 'category';
        }
        if ($has(['slug', 'sku', 'reference', 'ref', 'code'])) {
            return 'slug';
        }
        if ($has(['publie', 'published', 'visible', 'statut', 'actif', 'online'])) {
            return 'published';
        }
        if ($has(['image', 'photo', 'img', 'picture'])) {
            return 'image_link';
        }
        if ($has(['nom', 'name', 'produit', 'product', 'designation', 'libelle', 'titre', 'article', 'intitule'])) {
            return 'name';
        }

        return null;
    }

    private function hasToken(array $tokens, array $words, bool $fuzzy): bool
    {
        foreach ($tokens as $t) {
            $singular = strlen($t) > 4 ? rtrim($t, 's') : $t;
            foreach ($words as $w) {
                if ($t === $w || $singular === $w) {
                    return true;
                }
                if ($fuzzy && strlen($w) >= 5 && strlen($t) >= 5 && levenshtein($t, $w) <= 1) {
                    return true;
                }
            }
        }

        return false;
    }

    private function headerScore(array $cells): int
    {
        $fields = [];
        $filled = 0;
        foreach ($cells as $h) {
            $n = $this->norm($this->str($h));
            if ($n === '') {
                continue;
            }
            $filled++;
            $k = $this->canonical($n) ?? $this->guessField($n, false);
            if ($k !== null) {
                $fields[$k] = true;
            }
        }
        if ($filled < 2) {
            return 0;
        }
        $score = count($fields);
        if (isset($fields['name']) || isset($fields['slug'])) {
            $score += 2;
        }

        return $score;
    }

    private function looksNumeric(string $v): bool
    {
        $v = mb_strtolower(trim($v));

        return preg_match('/^-?[\d\s.,\x{00A0}\x{202F}]+\s*(fcfa|f cfa|xof|cfa|f)?$/u', $v) === 1;
    }

    /** @param string[] $vals valeurs non vides */
    private function guessByContent(array $vals, array $taken): ?string
    {
        if (count($vals) < 2) {
            return null;
        }
        $all = fn (callable $fn) => count(array_filter($vals, $fn)) === count($vals);

        if (! isset($taken['image_link']) && $all(fn ($v) => preg_match('#^https?://#i', $v) === 1)) {
            return 'image_link';
        }
        if (! isset($taken['published']) && $all(fn ($v) => ! is_numeric($v) && $this->parseBool($v) !== null)) {
            return 'published';
        }
        if ($all(fn ($v) => $this->looksNumeric($v))) {
            $ints = array_map(fn ($v) => $this->parseInt($v), $vals);
            if (in_array(null, $ints, true)) {
                return null;
            }
            if (! isset($taken['price']) && max($ints) >= 500) {
                return 'price';
            }
            if (! isset($taken['stock']) && min($ints) >= 0) {
                return 'stock';
            }

            return null;
        }
        if (! isset($taken['name']) && ! isset($taken['slug'])) {
            $avg = array_sum(array_map('mb_strlen', $vals)) / count($vals);
            if ($avg >= 3 && $avg <= 120 && count(array_unique($vals)) >= count($vals) * 0.8) {
                return 'name';
            }
        }

        return null;
    }

    // =====================================================================
    //  MEMOIRE DES CORRESPONDANCES (titre normalise => champ)
    // =====================================================================

    /** @return array<string, string> */
    private function loadMemory(): array
    {
        try {
            $raw = (string) Setting::query()->where('key', self::MEMORY_KEY)->value('value');
            $a = json_decode($raw, true);

            return is_array($a) ? $a : [];
        } catch (Throwable) {
            return [];
        }
    }

    private function rememberMapping(array $headers, array $map): void
    {
        try {
            $mem = $this->loadMemory();
            foreach ($map as $i => $field) {
                $n = $this->norm($this->str($headers[$i] ?? ''));
                if ($n !== '') {
                    unset($mem[$n]);
                    $mem[$n] = $field;
                }
            }
            $mem = array_slice($mem, -200, null, true);
            Setting::query()->updateOrCreate(['key' => self::MEMORY_KEY], ['value' => json_encode($mem, JSON_UNESCAPED_UNICODE)]);
        } catch (Throwable $e) {
            report($e);
        }
    }

    // =====================================================================
    //  OUTILS
    // =====================================================================

    private function norm(string $s): string
    {
        $s = str_replace("\xEF\xBB\xBF", '', $s);
        $s = Str::ascii(mb_strtolower($s));

        return trim((string) preg_replace('/[^a-z0-9]+/', ' ', $s));
    }

    private function str(mixed $v): string
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

    private function blank(mixed $v): bool
    {
        return $this->str($v) === '';
    }

    private function blankRow(array $cells): bool
    {
        foreach ($cells as $c) {
            if (! $this->blank($c)) {
                return false;
            }
        }

        return true;
    }

    /** Entier tolere : "1 500 FCFA", "1.500", "1,500.50", 5.0 ... null si illisible. */
    private function parseInt(mixed $v, bool $floor = false): ?int
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

    private function parseBool(string $s): ?bool
    {
        $s = $this->norm($s);

        return match (true) {
            in_array($s, ['oui', 'o', 'yes', 'y', 'true', 'vrai', '1', 'publie', 'en ligne', 'actif', 'visible'], true) => true,
            in_array($s, ['non', 'n', 'no', 'false', 'faux', '0', 'brouillon', 'inactif', 'masque'], true) => false,
            default => null,
        };
    }

    private function preview(int $line, string $action, string $name, ?int $price, int $stock): void
    {
        if (count($this->report['preview']) < 100) {
            $this->report['preview'][] = ['row' => $line, 'action' => $action, 'name' => $name, 'price' => $price, 'stock' => $stock];
        }
    }

    private function issue(int $line, string $level, ?string $field, string $message, array $data = []): void
    {
        if (count($this->report['issues']) >= self::MAX_ISSUES) {
            $this->report['issues_truncated'] = true;

            return;
        }
        $this->report['issues'][] = [
            'row' => $line, 'level' => $level, 'field' => $field, 'message' => $message,
            'name' => Str::limit($this->str($data['name'] ?? ($data['slug'] ?? '')), 60),
        ];
    }
}