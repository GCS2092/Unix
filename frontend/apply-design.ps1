# Usage (depuis C:\Unix\Unix\frontend) :
#   .\apply-design.ps1            -> VERIFIE seulement, ne modifie rien
#   .\apply-design.ps1 -Apply     -> sauvegarde puis applique (uniquement si TOUTES les verifications passent)
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (-not (Test-Path "$root\src\index.css")) { throw "Lance ce script depuis C:\Unix\Unix\frontend" }
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Get-Txt($p) { [IO.File]::ReadAllText((Join-Path $root $p), $utf8) }
function Set-Txt($p, $t) { [IO.File]::WriteAllText((Join-Path $root $p), $t, $utf8) }

$changes = [ordered]@{}
$errors  = New-Object System.Collections.Generic.List[string]
function Fail($m) { $errors.Add($m); Write-Host "  [X] $m" -ForegroundColor Red }
function Ok($m)   { Write-Host "  [OK] $m" -ForegroundColor Green }

# ---------------------------------------------------------------- contenus
$theme = @'
@theme {
  /* Titres : Bricolage Grotesque. Texte : Inter (inchange) */
  --font-sans: "Inter Variable", system-ui, -apple-system, sans-serif;
  --font-display: "Bricolage Grotesque Variable", "Inter Variable", system-ui, sans-serif;

  /* Bleu Atlantique (marque) + soleil (action) */
  --color-primary: #0b4a6f;
  --color-primary-dark: #07324d;
  --color-primary-light: #d6ecf8;
  --color-accent: #f5a30b;
  --color-accent-dark: #d98a00;
  --color-page: #f5f8fa;
  --color-surface: #ffffff;
  --color-ink: #0c1b2a;
  --color-muted: #5b6b7b;
  --color-line: #dfe7ee;
  --color-success: #0f9d6b;
  --color-danger: #dc3545;

  --radius-card: 16px;
  --shadow-card: 0 1px 2px rgb(11 74 111 / 0.06), 0 4px 12px -4px rgb(11 74 111 / 0.08);
  --shadow-card-lg: 0 2px 4px rgb(11 74 111 / 0.06), 0 16px 32px -12px rgb(11 74 111 / 0.18);
}
'@

$headings = @'


h1, h2, h3 {
  font-family: var(--font-display);
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.price { font-family: var(--font-display); font-variant-numeric: tabular-nums; }
'@

$buttonStyles = @'
type Variant = "primary" | "accent" | "secondary" | "danger" | "ghost"
type Size = "sm" | "md" | "lg"

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold select-none transition duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 " +
  "active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-dark active:brightness-90",
  accent: "bg-accent text-ink shadow-sm hover:bg-accent-dark active:brightness-90",
  secondary: "border border-line bg-surface text-ink hover:border-primary/40 hover:bg-page active:bg-line/60",
  danger: "bg-danger text-white shadow-sm hover:brightness-95 active:brightness-90",
  ghost: "text-primary hover:bg-primary/10 active:bg-primary/20",
}

const sizes: Record<Size, string> = {
  sm: "min-h-[36px] px-3 py-1.5 text-sm",
  md: "min-h-[44px] px-4 py-2.5 text-sm",
  lg: "min-h-[52px] px-6 py-3 text-base",
}

export interface StyleOptions {
  variant?: Variant
  size?: Size
  full?: boolean
  className?: string
}

// Utilisable aussi sur un <Link> : <Link className={buttonClass({ variant: "secondary" })}>
export function buttonClass({ variant = "primary", size = "md", full = false, className = "" }: StyleOptions = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${full ? "w-full" : ""} ${className}`.trim()
}
'@

$productCard = @'
import { Link } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { catalogApi } from "../api/catalog"
import AddToCartButton from "./AddToCartButton"
import ImageCarousel from "./ImageCarousel"
import StockBadge from "./StockBadge"
import WhatsAppButton from "./WhatsAppButton"
import { useFormatPrice } from "../hooks/useFormatPrice"
import type { Product } from "../types"

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000

function isRecent(createdAt: string) {
  const time = new Date(createdAt).getTime()
  return Number.isFinite(time) && Date.now() - time < FOURTEEN_DAYS
}

export default function ProductCard({ product }: { product: Product }) {
  const { t } = useTranslation()
  const formatPrice = useFormatPrice()
  const queryClient = useQueryClient()
  const soldOut = product.in_stock === false
  const fresh = isRecent(product.created_at)
  const url = product.share_url ?? `${window.location.origin}/boutique/${product.slug}`
  const images = product.images && product.images.length > 0 ? product.images : product.image_url ? [product.image_url] : []
  const prefetch = () =>
    void queryClient.prefetchQuery({
      queryKey: ["product", product.slug],
      queryFn: async () => (await catalogApi.product(product.slug)).data.data,
      staleTime: 60_000,
    })

  return (
    <article
      data-tour="product-card"
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors duration-200 hover:border-primary/40 hover:shadow-card"
      onPointerEnter={prefetch}
      onTouchStart={prefetch}
    >
      <div className="bg-page">
        <ImageCarousel
          images={images}
          alt={product.name}
          to={`/boutique/${product.slug}`}
          ratio="aspect-square"
          fit="contain"
          imgClassName={soldOut ? "grayscale" : "mix-blend-multiply"}
        >
          <StockBadge inStock={product.in_stock} lowStock={product.low_stock} className="pointer-events-none absolute left-2 top-2" />
          {fresh && !soldOut && (
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-ink">
              {t("ux.new_badge")}
            </span>
          )}
        </ImageCarousel>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:p-4">
        <Link to={`/boutique/${product.slug}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-ink hover:text-primary sm:text-[15px]">
          {product.name}
        </Link>
        <p className="price text-xl font-bold text-primary">{formatPrice(product.price)}</p>
        <div className="mt-auto pt-2">
          <AddToCartButton type="product" id={product.id} inStock={product.in_stock} />
          <WhatsAppButton productName={product.name} productUrl={url} soldOut={soldOut} display="linkShort" className="mt-1.5" />
        </div>
      </div>
    </article>
  )
}
'@

$hero = @'
<section data-tour="hero" className="relative overflow-hidden rounded-card bg-primary-dark px-5 py-10 text-white shadow-card-lg sm:px-10 sm:py-16">
        <Contours />
        <div className="relative max-w-2xl">
          <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-6xl">{t("home.title", { name })}</h1>
          <p className="mt-4 max-w-xl text-base text-primary-light sm:text-lg">{t("home.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/boutique" className={buttonClass({ variant: "accent", size: "lg" })}>
              {t("home.browse")}
            </Link>
__COURSES__
            {WHATSAPP_NUMBER && (
              <a
                href={waGeneral}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={en ? "Write on WhatsApp" : "Écrire sur WhatsApp"}
                className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-xl border border-white/40 text-white transition hover:bg-white/10 active:scale-95"
              >
                <Svg d={CHAT} className="h-6 w-6" />
              </a>
            )}
          </div>
        </div>
      </section>

      <ul data-tour="trust" className="grid grid-cols-3 divide-x divide-line rounded-card border border-line bg-surface">
        {trust.map((item) => (
          <li key={item.label} className="flex flex-col items-center gap-1.5 px-2 py-3.5 text-center text-xs font-medium leading-snug text-ink sm:flex-row sm:justify-center sm:gap-3 sm:text-sm">
            <span className="text-primary"><Svg d={item.d} className="h-6 w-6" /></span>
            {item.label}
          </li>
        ))}
      </ul>
'@

$coursesBtn = @'
            <Link to="__ROUTE__" className={buttonClass({ variant: "ghost", size: "lg", className: "border border-white/40 !text-white hover:!bg-white/10" })}>
              {en ? "Browse courses" : "Voir les formations"}
            </Link>
'@

function Replace-Once($text, $pattern, $new) {
  $re = New-Object System.Text.RegularExpressions.Regex($pattern, 'Singleline')
  $ms = $re.Matches($text)
  if ($ms.Count -ne 1) { return $null }
  $ev = [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $new }
  return $re.Replace($text, $ev, 1)
}

# ---------------------------------------------------------------- 1. index.css
Write-Host "`n1) src\index.css"
$f = 'src\index.css'
if (-not (Test-Path $f)) { Fail "$f introuvable" } else {
  $css = Get-Txt $f
  if ($css -match '\.price\s*\{') { Ok "deja applique (ignore)" }
  elseif ($css -notmatch '--color-primary:\s*#0b4a6f' -or $css -notmatch '--radius-card:\s*12px') { Fail "le bloc @theme ne ressemble plus a ce que j'ai vu : rien modifie" }
  else {
    $r = Replace-Once $css '@theme\s*\{.*?\r?\n\}' $theme
    if ($null -eq $r) { Fail "bloc @theme : correspondance non unique" }
    else {
      $m = [regex]::Match($r, '\r?\nbody\s*\{.*?\r?\n\}', 'Singleline')
      if (-not $m.Success) { Fail "regle body{} introuvable" }
      else {
        $r = $r.Insert($m.Index + $m.Length, $headings)
        $changes[$f] = $r; Ok "theme remplace + regles titres/prix ajoutees"
      }
    }
  }
}

# ---------------------------------------------------------------- 2. buttonStyles.ts
Write-Host "`n2) src\components\buttonStyles.ts"
$f = 'src\components\buttonStyles.ts'
if (-not (Test-Path $f)) { Fail "$f introuvable" } else {
  $t = Get-Txt $f
  if ($t -match '"accent"') { Ok "deja applique (ignore)" }
  elseif ($t -notmatch 'type Variant = "primary" \| "secondary" \| "danger" \| "ghost"' -or $t -notmatch 'export function buttonClass') { Fail "fichier different de celui que j'ai vu : rien modifie" }
  else { $changes[$f] = $buttonStyles; Ok "variante accent ajoutee, rayons/tailles ajustes" }
}

# ---------------------------------------------------------------- 3. ProductCard.tsx
Write-Host "`n3) src\components\ProductCard.tsx"
$f = 'src\components\ProductCard.tsx'
if (-not (Test-Path $f)) { Fail "$f introuvable" } else {
  $t = Get-Txt $f
  if ($t -match 'bg-page">\s*<ImageCarousel') { Ok "deja applique (ignore)" }
  elseif ($t -notmatch 'hover:-translate-y-0\.5' -or $t -notmatch 'data-tour="product-card"' -or $t -notmatch 'AddToCartButton type="product"') { Fail "fichier different de celui que j'ai vu : rien modifie" }
  else { $changes[$f] = $productCard; Ok "carte redessinee (memes props et logique)" }
}

# ---------------------------------------------------------------- 4. HomePage.tsx
Write-Host "`n4) src\pages\HomePage.tsx"
$f = 'src\pages\HomePage.tsx'
$route = $null
foreach ($nf in 'src\lib\navLinks.ts', 'src\App.tsx') {
  if (-not $route -and (Test-Path $nf)) {
    $mm = [regex]::Matches((Get-Txt $nf), '["''](/(?:formations?|cours)(?:/[^"'']*)?)["'']')
    foreach ($x in $mm) { if ($x.Groups[1].Value -notmatch ':|\*') { $route = $x.Groups[1].Value; break } }
  }
}
if ($route) { Write-Host "  route formations detectee : $route" } else { Write-Host "  aucune route publique 'formations/cours' detectee : bouton formations non ajoute" -ForegroundColor Yellow }
if (-not (Test-Path $f)) { Fail "$f introuvable" } else {
  $t = Get-Txt $f
  if ($t -match 'variant:\s*"accent"') { Ok "deja applique (ignore)" }
  else {
    foreach ($need in 'Contours', 'waGeneral', 'WHATSAPP_NUMBER', 'const trust', 'CHAT', 'buttonClass', '<section data-tour="hero"', '<ul data-tour="trust"') {
      if ($t -notmatch [regex]::Escape($need)) { Fail "HomePage : '$need' introuvable" }
    }
    if (-not ($errors | Where-Object { $_ -like 'HomePage*' })) {
      $block = $hero.Replace('__COURSES__', $(if ($route) { $coursesBtn.TrimEnd().Replace('__ROUTE__', $route) } else { '' }))
      $r = Replace-Once $t '<section data-tour="hero".*?</section>\s*<ul data-tour="trust".*?</ul>' $block
      if ($null -eq $r) { Fail "HomePage : bloc hero+trust non unique ou different" }
      else { $changes[$f] = $r; Ok "hero + bandeau de confiance remplaces (reste du fichier intact)" }
    }
  }
}

# ---------------------------------------------------------------- 5. police
Write-Host "`n5) police Bricolage Grotesque (src\main.tsx)"
$mainOk = $false
if (Test-Path 'src\main.tsx') {
  $mt = Get-Txt 'src\main.tsx'
  if ($mt -match 'bricolage-grotesque') { Ok "deja importee" }
  elseif ($mt -match '(import\s+["'']@fontsource-variable/inter["''];?[^\r\n]*)') { $mainOk = $true; Ok "import Inter trouve, j'ajoute Bricolage juste apres" }
  else { Write-Host "  import Inter non trouve dans main.tsx : la police de titre retombera sur Inter (aucun risque)" -ForegroundColor Yellow }
}

# ---------------------------------------------------------------- bilan
Write-Host ""
if ($errors.Count -gt 0) {
  Write-Host "ARRET : $($errors.Count) verification(s) en echec. RIEN n'a ete modifie." -ForegroundColor Red
  Write-Host "Copie-colle-moi ces lignes d'erreur et le fichier concerne, j'adapte."
  return
}
if (-not $Apply) {
  Write-Host "Verifications OK pour $($changes.Count) fichier(s). Aucune modification faite." -ForegroundColor Green
  Write-Host "Pour appliquer :  .\apply-design.ps1 -Apply"
  return
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bak = Join-Path $root "backup-design-$stamp"
foreach ($k in $changes.Keys) {
  $dest = Join-Path $bak $k
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Copy-Item (Join-Path $root $k) $dest
}
if ($mainOk) { $d = Join-Path $bak 'src\main.tsx'; New-Item -ItemType Directory -Force -Path (Split-Path $d) | Out-Null; Copy-Item (Join-Path $root 'src\main.tsx') $d }
foreach ($k in $changes.Keys) { Set-Txt $k $changes[$k]; Write-Host "ecrit : $k" -ForegroundColor Green }

if ($mainOk) {
  Write-Host "npm install @fontsource-variable/bricolage-grotesque ..."
  npm install @fontsource-variable/bricolage-grotesque
  if ($LASTEXITCODE -eq 0) {
    $mt = Get-Txt 'src\main.tsx'
    $mt = [regex]::Replace($mt, '(import\s+["'']@fontsource-variable/inter["''];?[^\r\n]*)', '$1' + "`nimport `"@fontsource-variable/bricolage-grotesque`"", 1)
    Set-Txt 'src\main.tsx' $mt
    Write-Host "ecrit : src\main.tsx" -ForegroundColor Green
  } else { Write-Host "npm a echoue : main.tsx non modifie (les titres utiliseront Inter)" -ForegroundColor Yellow }
}
Write-Host "`nSauvegardes dans : $bak"
Write-Host "Lance maintenant :  npm run dev   (et  npx tsc --noEmit  pour verifier les types)"
