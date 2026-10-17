<?php

namespace App\Services;

use App\Enums\StockMovementReason;
use App\Models\Category;
use App\Models\Product;
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

    /** @return array<string, mixed> */
    public function run(string $path, string $ext, bool $dryRun, bool $publishDefault, ?User $admin): array
    {
        [$map, $unknown, $rows] = $this->read($path, $ext);

        $this->report = [
            'dry_run' => $dryRun, 'total' => 0, 'created' => 0, 'updated' => 0,
            'unchanged' => 0, 'skipped' => 0, 'unknown_columns' => $unknown,
            'issues' => [], 'preview' => [],
        ];

        $this->categories = [];
        foreach (Category::query()->get() as $c) {
            $this->categories[mb_strtolower(trim((string) $c->name))] = $c->id;
            $this->categories[mb_strtolower((string) $c->slug)] = $c->id;
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
                $this->report[$result]++;
            }
        } finally {
            $dryRun ? DB::rollBack() : DB::commit();
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
            $s = $this->parseInt($d['stock'], true); // stock : arrondi vers le bas
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

        // Categorie
        $cat = $this->str($d['category'] ?? null);
        if ($cat !== '') {
            $id = $this->categories[mb_strtolower($cat)] ?? null;
            if ($id === null) {
                $this->issue($line, 'warning', 'category', 'Categorie inconnue ("'.Str::limit($cat, 40).'"), ignoree.', $d);
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
            $attrs['name'] = $name; // retrouve par slug : renommage autorise
        }
        $product->fill($attrs);
        $changed = $product->isDirty();
        if ($changed) {
            $product->save();
        }
        $stockChanged = false;
        if ($stock !== null && $stock !== (int) $product->stock) {
            $stockService->setTo($product, $stock, StockMovementReason::Inventory, $admin, 'Import Excel');
            $stockChanged = true;
        }
        $seen[$product->id] = $line;

        $action = ($changed || $stockChanged) ? 'update' : 'unchanged';
        $this->preview($line, $action, $product->name, $attrs['price'] ?? (int) $product->price, $stock ?? (int) $product->stock);

        return $action === 'update' ? 'updated' : 'unchanged';
    }

    /** @return array{0: array<int,string>, 1: array<int,string>, 2: array<int, array{0:int,1:array}>} */
    private function read(string $path, string $ext): array
    {
        if (in_array($ext, ['csv', 'txt'], true)) {
            $head = (string) file_get_contents($path, false, null, 0, 65536);
            $first = strtok($head, "\n") ?: '';
            $delims = [';' => substr_count($first, ';'), ',' => substr_count($first, ','), "\t" => substr_count($first, "\t")];
            arsort($delims);
            $delimiter = (string) array_key_first($delims);
            $chunk = strlen($head) >= 65536 ? substr($head, 0, (int) strrpos($head, "\n")) : $head;
            $encoding = ($chunk !== '' && ! mb_check_encoding($chunk, 'UTF-8')) ? 'Windows-1252' : 'UTF-8';
            // OpenSpout 5 : les options sont immuables, on les passe au constructeur.
            $reader = new CsvReader(new CsvOptions(FIELD_DELIMITER: $delimiter, ENCODING: $encoding));
        } else {
            $reader = new XlsxReader(new XlsxOptions(SHOULD_PRESERVE_EMPTY_ROWS: true));
        }

        $map = [];
        $unknown = [];
        $rows = [];
        $headerDone = false;
        $line = 0;

        try {
            $reader->open($path);
            foreach ($reader->getSheetIterator() as $sheet) {
                foreach ($sheet->getRowIterator() as $row) {
                    $line++;
                    $cells = $row->toArray();
                    if ($this->blankRow($cells)) {
                        continue;
                    }
                    if (! $headerDone) {
                        foreach ($cells as $i => $h) {
                            $raw = $this->str($h);
                            $n = $this->norm($raw);
                            if ($n === '') {
                                continue;
                            }
                            $key = $this->canonical($n);
                            if ($key === null) {
                                $unknown[] = $raw;
                            } elseif (! in_array($key, $map, true)) {
                                $map[$i] = $key;
                            }
                        }
                        if (! in_array('name', $map, true) && ! in_array('slug', $map, true)) {
                            throw new \RuntimeException('Colonne "nom" introuvable. Utilisez le modele : la premiere ligne doit contenir les titres des colonnes.');
                        }
                        $headerDone = true;

                        continue;
                    }
                    if (count($rows) >= self::MAX_ROWS) {
                        throw new \RuntimeException('Fichier trop gros : maximum '.self::MAX_ROWS.' lignes par import. Decoupez-le en plusieurs fichiers.');
                    }
                    $rows[] = [$line, $cells];
                }
                break; // premiere feuille uniquement
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

        if (! $headerDone) {
            throw new \RuntimeException('Fichier vide.');
        }

        return [$map, $unknown, $rows];
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