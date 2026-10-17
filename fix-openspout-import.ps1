<#
  fix-openspout-import.ps1
  Corrige l'import de produits avec OpenSpout 5 (options en lecture seule : il faut les passer au constructeur).
  Erreur corrigee : "Cannot modify readonly property OpenSpout\Reader\CSV\Options::$FIELD_DELIMITER"

  Usage (depuis la racine du projet) :
    cd C:\Unix\Unix
    powershell -ExecutionPolicy Bypass -File .\fix-openspout-import.ps1
#>
param([switch]$SkipTests)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'artisan'))) {
    throw "Lance ce script depuis la racine du projet Laravel (le dossier qui contient 'artisan')."
}

$rel  = 'app/Services/ProductImporter.php'
$path = Join-Path $root $rel
if (-not (Test-Path $path)) { throw "Fichier introuvable : $rel" }

$old = @'
            $opts = new CsvOptions();
            $delims = [';' => substr_count($first, ';'), ',' => substr_count($first, ','), "\t" => substr_count($first, "\t")];
            arsort($delims);
            $opts->FIELD_DELIMITER = (string) array_key_first($delims);
            $chunk = strlen($head) >= 65536 ? substr($head, 0, (int) strrpos($head, "\n")) : $head;
            if ($chunk !== '' && ! mb_check_encoding($chunk, 'UTF-8')) {
                $opts->ENCODING = 'Windows-1252';
            }
            $reader = new CsvReader($opts);
        } else {
            $xo = new XlsxOptions();
            $xo->SHOULD_PRESERVE_EMPTY_ROWS = true;
            $reader = new XlsxReader($xo);
        }
'@

$new = @'
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
'@

function Get-Occurrences([string]$text, [string]$needle) {
    $n = 0; $i = 0
    while (($i = $text.IndexOf($needle, $i, [System.StringComparison]::Ordinal)) -ge 0) { $n++; $i += $needle.Length }
    return $n
}

$raw  = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$eol  = if ($raw.Contains("`r`n")) { "`r`n" } else { "`n" }
$text = $raw.Replace("`r`n", "`n")
$old  = $old.Replace("`r`n", "`n")
$new  = $new.Replace("`r`n", "`n")

if ((Get-Occurrences $text $new) -ge 1) {
    Write-Host 'Correctif deja applique. Rien a faire.' -ForegroundColor Yellow
} else {
    $count = Get-Occurrences $text $old
    if ($count -ne 1) {
        throw "Point de remplacement trouve $count fois (attendu : 1) dans $rel. Rien n'a ete modifie."
    }

    $stamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path (Join-Path $root '.backup-admin-ui') "$stamp-openspout-fix"
    $dest   = Join-Path $backup $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item -LiteralPath $path -Destination $dest
    Write-Host "Sauvegarde : $dest" -ForegroundColor Cyan

    $final = $text.Replace($old, $new)
    if ($eol -eq "`r`n") { $final = $final.Replace("`n", "`r`n") }
    [System.IO.File]::WriteAllText($path, $final, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Modifie : $rel" -ForegroundColor Green
}

Write-Host ''
Write-Host '== Syntaxe PHP ==' -ForegroundColor Cyan
& php -l $path

if (-not $SkipTests) {
    Write-Host ''
    Write-Host '== php artisan test --filter=Stock ==' -ForegroundColor Cyan
    & php artisan test --filter=Stock
}
