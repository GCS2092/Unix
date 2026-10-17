<#
  apply-stock-fixes.ps1
  Applique les correctifs stock (StockService, ProductImporter, Product, DashboardController)
  + ajoute des tests de non-regression.

  Usage (depuis la racine du projet Laravel), macOS / Linux / Windows avec PowerShell 7 (pwsh) :
    cd /chemin/vers/le/projet
    pwsh ./apply-stock-fixes.ps1
    pwsh ./apply-stock-fixes.ps1 -SkipTests   # sans lancer les tests

  Securite :
    - Rien n'est ecrit tant que TOUS les points de remplacement n'ont pas ete trouves (une seule fois).
    - Chaque fichier modifie est sauvegarde dans .backup-admin-ui/<date>-stock-hardening
    - Le script peut etre relance : les correctifs deja appliques sont detectes et ignores.
#>
param([switch]$SkipTests)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path

if (-not (Test-Path (Join-Path $root 'artisan'))) {
    throw "Lance ce script depuis la racine du projet Laravel (le dossier qui contient 'artisan'). Exemple : cd ~/Unix"
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Get-Occurrences([string]$text, [string]$needle) {
    $n = 0
    $i = 0
    while (($i = $text.IndexOf($needle, $i, [System.StringComparison]::Ordinal)) -ge 0) {
        $n++
        $i += $needle.Length
    }
    return $n
}

# ---------------------------------------------------------------------------
# Definition des correctifs : File / Old (texte exact a remplacer) / New
# ---------------------------------------------------------------------------
$patches = @()

# 1a. StockService::reserve - transaction obligatoire + garde anti double reservation
$patches += [pscustomobject]@{
    File = 'app/Services/StockService.php'
    Old  = @'
    public function reserve(Order $order, ?Carbon $expiresAt = null): void
    {
        $quantities = $this->productQuantities($order);
'@
    New  = @'
    public function reserve(Order $order, ?Carbon $expiresAt = null): void
    {
        // Hors transaction, lockForUpdate ne protege rien : on s'enveloppe nous-memes.
        if (DB::transactionLevel() === 0) {
            DB::transaction(fn () => $this->reserve($order, $expiresAt));

            return;
        }

        // Garde anti double reservation : le drapeau est relu EN BASE, sous verrou.
        $alreadyHeld = (bool) Order::query()->whereKey($order->getKey())->lockForUpdate()->value('stock_reserved');
        if ($alreadyHeld) {
            return;
        }

        $quantities = $this->productQuantities($order);
'@
}

# 1b. StockService::release - garde anti double liberation (cron + webhook simultanes)
$patches += [pscustomobject]@{
    File = 'app/Services/StockService.php'
    Old  = @'
        if (! $order->stock_reserved) {
            return false;
        }

        $quantities = $this->productQuantities($order);
        $products = $this->lockProducts(array_keys($quantities));
'@
    New  = @'
        if (DB::transactionLevel() === 0) {
            return DB::transaction(fn (): bool => $this->release($order, $reason));
        }

        // Garde anti double liberation (cron d'expiration + webhook en meme temps) :
        // le drapeau est relu EN BASE sous verrou, pas sur l'objet en memoire.
        $held = (bool) Order::query()->whereKey($order->getKey())->lockForUpdate()->value('stock_reserved');
        if (! $held) {
            return false;
        }

        $quantities = $this->productQuantities($order);
        $products = $this->lockProducts(array_keys($quantities));
'@
}

# 2. Import : prix a 0 refuse a la creation
$patches += [pscustomobject]@{
    File = 'app/Services/ProductImporter.php'
    Old  = 'if ($p === null || $p < 0 || $p > 2000000000) {'
    New  = 'if ($p === null || $p < ($creating ? 1 : 0) || $p > 2000000000) {'
}

# 3. Import : stock decimal arrondi vers le BAS (jamais vers le haut)
$patches += [pscustomobject]@{
    File = 'app/Services/ProductImporter.php'
    Old  = '$s = $this->parseInt($d[''stock'']);'
    New  = '$s = $this->parseInt($d[''stock''], true); // stock : arrondi vers le bas'
}
$patches += [pscustomobject]@{
    File = 'app/Services/ProductImporter.php'
    Old  = 'private function parseInt(mixed $v): ?int'
    New  = 'private function parseInt(mixed $v, bool $floor = false): ?int'
}
$patches += [pscustomobject]@{
    File = 'app/Services/ProductImporter.php'
    Old  = '            return (int) round($v);'
    New  = '            return $floor ? (int) floor($v) : (int) round($v);'
}
$patches += [pscustomobject]@{
    File = 'app/Services/ProductImporter.php'
    Old  = '$n = (int) round((float) $s);'
    New  = '$n = $floor ? (int) floor((float) $s) : (int) round((float) $s);'
}

# 4. Product : definition UNIQUE du "stock faible" (1 <= stock <= seuil)
$patches += [pscustomobject]@{
    File = 'app/Models/Product.php'
    Old  = '    public function isInStock(int $quantity = 1): bool'
    New  = @'
    /** Stock faible = au moins 1 unite ET au plus le seuil (0 = rupture, compte a part). */
    public function scopeLowStock(\Illuminate\Database\Eloquent\Builder $query, int $threshold): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('stock', '>', 0)->where('stock', '<=', $threshold);
    }

    public function isInStock(int $quantity = 1): bool
'@
}

# 5. Tableau de bord : meme definition que la page Stock (ne compte plus les ruptures)
$patches += [pscustomobject]@{
    File = 'app/Http/Controllers/Admin/DashboardController.php'
    Old  = '$lowStock = Product::query()->where(''stock'', ''<='', $threshold)->orderBy(''stock'')->limit(5)'
    New  = '$lowStock = Product::query()->lowStock($threshold)->orderBy(''stock'')->limit(5)'
}
$patches += [pscustomobject]@{
    File = 'app/Http/Controllers/Admin/DashboardController.php'
    Old  = '''low_stock_count'' => Product::query()->where(''stock'', ''<='', $threshold)->count(),'
    New  = '''low_stock_count'' => Product::query()->lowStock($threshold)->count(),'
}

# ---------------------------------------------------------------------------
# Phase 1 : tout valider en memoire (aucune ecriture)
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '== Verification des fichiers ==' -ForegroundColor Cyan

$plans = @()
foreach ($group in ($patches | Group-Object -Property File)) {
    $path = Join-Path $root $group.Name
    if (-not (Test-Path $path)) {
        throw "Fichier introuvable : $($group.Name)"
    }

    $raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $eol  = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
    $text = $raw.Replace("`r`n", "`n")

    $applied = 0
    $already = 0

    foreach ($p in $group.Group) {
        $old = $p.Old.Replace("`r`n", "`n")
        $new = $p.New.Replace("`r`n", "`n")

        if ((Get-Occurrences $text $new) -ge 1) {
            $already++
            continue
        }

        $count = Get-Occurrences $text $old
        if ($count -ne 1) {
            $preview = ($old -split "`n")[0].Trim()
            throw "[$($group.Name)] point de remplacement trouve $count fois (attendu : 1) : $preview`nLe fichier a probablement change depuis l'audit. Rien n'a ete modifie."
        }

        $text = $text.Replace($old, $new)
        $applied++
    }

    $final = if ($eol -eq "`r`n") { $text.Replace("`n", "`r`n") } else { $text }

    $plans += [pscustomobject]@{
        Rel     = $group.Name
        Path    = $path
        Final   = $final
        Applied = $applied
        Already = $already
    }

    Write-Host ("  {0,-55} a appliquer : {1}  deja fait : {2}" -f $group.Name, $applied, $already)
}

# ---------------------------------------------------------------------------
# Phase 2 : sauvegarde puis ecriture
# ---------------------------------------------------------------------------
$stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path (Join-Path $root '.backup-admin-ui') "$stamp-stock-hardening"

$toWrite = @($plans | Where-Object { $_.Applied -gt 0 })

if ($toWrite.Count -eq 0) {
    Write-Host ''
    Write-Host 'Tous les correctifs sont deja appliques. Rien a faire.' -ForegroundColor Yellow
} else {
    Write-Host ''
    Write-Host "== Sauvegarde : $backup ==" -ForegroundColor Cyan
    foreach ($plan in $toWrite) {
        $dest = Join-Path $backup $plan.Rel
        New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
        Copy-Item -LiteralPath $plan.Path -Destination $dest
    }

    Write-Host '== Ecriture des correctifs ==' -ForegroundColor Cyan
    foreach ($plan in $toWrite) {
        [System.IO.File]::WriteAllText($plan.Path, $plan.Final, $utf8NoBom)
        Write-Host "  modifie : $($plan.Rel)" -ForegroundColor Green
    }
}

# ---------------------------------------------------------------------------
# Tests de non-regression (nouveau fichier, jamais ecrase)
# ---------------------------------------------------------------------------
$testRel  = 'tests/Feature/StockHardeningTest.php'
$testPath = Join-Path $root $testRel

$testCode = @'
<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\StockMovementReason;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function orderFor(Product $product, int $qty): Order
    {
        $order = Order::query()->create([
            'user_id' => User::factory()->create()->id,
            'status' => OrderStatus::Pending,
            'total' => $product->price * $qty,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.Str::uuid()->toString(),
        ]);

        $order->items()->create([
            'itemable_type' => Product::class,
            'itemable_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => $product->price,
            'line_total' => $product->price * $qty,
        ]);

        return $order;
    }

    public function test_release_called_twice_with_a_stale_order_restores_stock_only_once(): void
    {
        $product = Product::factory()->create(['stock' => 3, 'is_published' => true]);
        $order = $this->orderFor($product, 2);
        $order->forceFill(['stock_reserved' => true])->save();

        $stale = Order::query()->findOrFail($order->id); // copie qui croit encore que le stock est reserve
        $service = app(StockService::class);

        $this->assertTrue($service->release($order, StockMovementReason::Expire));
        $this->assertFalse($service->release($stale, StockMovementReason::Release));
        $this->assertSame(5, $product->fresh()->stock);
    }

    public function test_reserve_called_twice_decrements_stock_only_once(): void
    {
        $product = Product::factory()->create(['stock' => 5, 'is_published' => true]);
        $order = $this->orderFor($product, 2);
        $service = app(StockService::class);

        $service->reserve($order);
        $service->reserve(Order::query()->findOrFail($order->id));

        $this->assertSame(3, $product->fresh()->stock);
    }

    public function test_dashboard_and_stock_page_count_the_same_low_stock_products(): void
    {
        Product::factory()->create(['stock' => 0, 'is_published' => true]);
        Product::factory()->create(['stock' => 2, 'is_published' => true]);
        Product::factory()->create(['stock' => 20, 'is_published' => true]);

        Sanctum::actingAs($this->admin());

        $dashboard = $this->getJson('/api/v1/admin/dashboard')->assertOk()->json();
        $stockPage = $this->getJson('/api/v1/admin/stock')->assertOk()->json();

        $dashCount = data_get($dashboard, 'snapshot.low_stock_count', data_get($dashboard, 'data.snapshot.low_stock_count'));

        $this->assertSame(1, $dashCount);
        $this->assertSame(1, data_get($stockPage, 'summary.low_count'));
    }

    public function test_import_rounds_stock_down_and_refuses_a_zero_price_on_creation(): void
    {
        Sanctum::actingAs($this->admin());

        $csv = "nom;prix;stock\nAlpha test;1000;2,5\nGratuit test;0;3\n";
        $file = UploadedFile::fake()->createWithContent('produits.csv', $csv);

        $this->postJson('/api/v1/admin/product-import', ['file' => $file])->assertOk();

        $this->assertSame(2, Product::query()->where('name', 'Alpha test')->value('stock'));
        $this->assertFalse(Product::query()->where('name', 'Gratuit test')->exists());
    }
}
'@

Write-Host ''
if (Test-Path $testPath) {
    Write-Host "Tests : $testRel existe deja, non ecrase." -ForegroundColor Yellow
} else {
    [System.IO.File]::WriteAllText($testPath, ($testCode.Replace("`r`n", "`n")), $utf8NoBom)
    Write-Host "Tests : $testRel cree." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Vidage du cache (le tableau de bord met son resultat en cache) + verifications
# ---------------------------------------------------------------------------
if (-not $SkipTests) {
    Write-Host ''
    Write-Host '== php artisan cache:clear ==' -ForegroundColor Cyan
    & php artisan cache:clear

    Write-Host ''
    Write-Host '== php artisan test --filter=Stock ==' -ForegroundColor Cyan
    & php artisan test --filter=Stock
    $testsExit = $LASTEXITCODE

    Write-Host ''
    Write-Host '== php artisan stock:audit ==' -ForegroundColor Cyan
    & php artisan stock:audit

    Write-Host ''
    if ($testsExit -eq 0) {
        Write-Host 'Tests OK.' -ForegroundColor Green
    } else {
        Write-Host 'Des tests echouent : envoie-moi la sortie ci-dessus.' -ForegroundColor Red
    }
}

if ($toWrite.Count -gt 0) {
    Write-Host ''
    Write-Host 'Pour tout annuler :' -ForegroundColor Cyan
    Write-Host "  Copy-Item -Path '$backup/*' -Destination '$root' -Recurse -Force"
}
