$ErrorActionPreference = "Stop"
Set-Location C:\Unix
$email = "admin@unix.test"
$pass  = "Admin-Local-2026!"
$base  = "http://127.0.0.1:8000"
$api   = "$base/api/v1"
$script:token = $null
$script:fails = 0

function Step($m)  { Write-Host "`n== $m" -ForegroundColor Yellow }
function Check($cond, $msg) {
  if ($cond) { Write-Host "  OK      $msg" -ForegroundColor Green }
  else { Write-Host "  ECHEC   $msg" -ForegroundColor Red; $script:fails++ }
}
function Call($method, $path, $body = $null, $lang = "fr", [switch]$Anon) {
  $h = @{ Accept = "application/json"; "Accept-Language" = $lang }
  if ($script:token -and -not $Anon) { $h.Authorization = "Bearer $script:token" }
  $p = @{ Method = $method; Uri = "$api$path"; Headers = $h }
  if ($null -ne $body) {
    $p.Body = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 5))
    $p.ContentType = "application/json; charset=utf-8"
  }
  Invoke-RestMethod @p
}
function StatusOf($method, $path, $body = $null, [switch]$Anon) {
  try { $null = Call $method $path $body "fr" -Anon:$Anon; return 200 }
  catch { return [int]$_.Exception.Response.StatusCode }
}

Step "Demarrage du serveur local ($base)"
$srv = Start-Process php -ArgumentList "artisan","serve","--host=127.0.0.1","--port=8000" -PassThru -WindowStyle Hidden
try {
  $up = $false
  for ($i = 0; $i -lt 20 -and -not $up; $i++) {
    Start-Sleep -Milliseconds 700
    try { $null = Invoke-WebRequest "$api/catalog/products" -UseBasicParsing -Headers @{Accept="application/json"}; $up = $true } catch {}
  }
  Check $up "serveur joignable"
  if (-not $up) { throw "Le serveur ne repond pas (port 8000 deja utilise ?)" }

  Step "Connexion"
  $r = Call POST "/auth/login" @{ email = $email; password = $pass } -Anon
  $script:token = if ($r.token) { $r.token } else { $r.data.token }
  Check ([bool]$script:token) "token recu"
  $me = Call GET "/auth/me"
  $isAdmin = $me.user.is_admin
  Check ($isAdmin -eq $true) "le compte est administrateur"

  Step "Creation d'un produit bilingue"
  $new = Call POST "/admin/products" @{
    name = "Sac en cuir"; name_en = "Leather bag"
    description = "Un beau sac en cuir."; description_en = "A nice leather bag."
    price = 15000; stock = 10; is_published = $true
  }
  $slug = $new.data.slug
  Check ([bool]$slug) "produit cree, slug = $slug"
  Check ($new.data.name_en -eq "Leather bag") "l'admin recoit name_en"

  Step "Langue cote boutique (visiteur non connecte)"
  $fr = Call GET "/catalog/products/$slug" $null "fr" -Anon
  $en = Call GET "/catalog/products/$slug" $null "en" -Anon
  Check ($fr.data.name -eq "Sac en cuir") "FR : nom francais"
  Check ($en.data.name -eq "Leather bag") "EN : nom anglais"
  Check ($en.data.description -eq "A nice leather bag.") "EN : description anglaise"

  Step "Repli sur le francais sans traduction"
  $t = Call POST "/admin/products" @{ name = "Produit temporaire"; price = 1000; stock = 1; is_published = $true }
  $tslug = $t.data.slug
  $tEn = Call GET "/catalog/products/$tslug" $null "en" -Anon
  Check ($tEn.data.name -eq "Produit temporaire") "EN sans traduction : nom francais"

  Step "Televersement d'une image"
  Add-Type -AssemblyName System.Drawing
  $png = Join-Path $env:TEMP "unix-test.png"
  $bmp = New-Object System.Drawing.Bitmap 300,300
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::SteelBlue); $g.Dispose()
  $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()

  $raw = curl.exe -s -X POST "$api/admin/products/$slug/image" -H "Authorization: Bearer $script:token" -H "Accept: application/json" -F "image=@$png;type=image/png"
  $up1 = ($raw -join "") | ConvertFrom-Json
  $imgUrl = $up1.data.image_url
  Check ([bool]$imgUrl) "image_url renvoye : $imgUrl"
  $leaf = if ($imgUrl) { Split-Path $imgUrl -Leaf } else { "?" }
  Check (Test-Path "storage\app\public\products\$leaf") "fichier present sur le disque"
  try {
    $img = Invoke-WebRequest $imgUrl -UseBasicParsing
    Check ($img.StatusCode -eq 200 -and $img.Headers["Content-Type"] -like "image/*") "image accessible par HTTP"
  } catch { Check $false "image inaccessible par HTTP : verifie APP_URL dans .env (attendu $base)" }
  $pub = Call GET "/catalog/products/$slug" $null "fr" -Anon
  Check ($pub.data.image_url -eq $imgUrl) "la boutique voit l'image"

  Step "Remplacement par un lien"
  $lk = Call PATCH "/admin/products/$slug" @{ image_link = "https://example.com/a.jpg" }
  Check ($lk.data.image_url -eq "https://example.com/a.jpg") "image_url = le lien"
  Check (-not (Test-Path "storage\app\public\products\$leaf")) "ancien fichier supprime du disque"

  Step "Validation"
  Check ((StatusOf PATCH "/admin/products/$slug" @{ image_link = "javascript:alert(1)" }) -eq 422) "lien javascript: refuse (422)"

  Step "Retrait de l'image"
  $rm = Call DELETE "/admin/products/$slug/image"
  Check ($null -eq $rm.data.image_url) "image_url vide"

  Step "Depublier puis publier"
  $null = Call PATCH "/admin/products/$slug" @{ is_published = $false }
  $code = StatusOf GET "/catalog/products/$slug" -Anon
  Check ($code -in 403,404) "depublie : page detail refusee au visiteur (code $code)"
  $list = Call GET "/catalog/products" $null "fr" -Anon
  Check (-not ($list.data | Where-Object { $_.slug -eq $slug })) "depublie : absent de la liste publique"
  $null = Call PATCH "/admin/products/$slug" @{ is_published = $true }
  Check ((StatusOf GET "/catalog/products/$slug" -Anon) -eq 200) "republie : visible"

  Step "Suppression du produit temporaire"
  $null = Call DELETE "/admin/products/$tslug"
  Check ((StatusOf GET "/admin/products/$tslug") -eq 404) "produit supprime"

  Step "Securite : un visiteur ne peut pas utiliser l'admin"
  Check ((StatusOf GET "/admin/products" -Anon) -in 401,403) "admin refuse sans connexion"
}
finally {
  taskkill /PID $srv.Id /T /F | Out-Null
}

Write-Host ""
if ($script:fails -eq 0) { Write-Host "Tout est OK. Produit '$slug' conserve dans ta base locale." -ForegroundColor Green }
else { Write-Host "$script:fails verification(s) en echec : colle-moi la sortie." -ForegroundColor Red }