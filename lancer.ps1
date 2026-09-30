Set-Location C:\Unix
$utf8 = New-Object Text.UTF8Encoding($false)

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "Ouvre PowerShell en administrateur (necessaire pour le pare-feu)." }

$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } | Select-Object -First 1).IPAddress
if (-not $ip) { throw "Aucune adresse reseau locale trouvee." }

$e = [IO.File]::ReadAllText("C:\Unix\.env")
$e = [regex]::Replace($e, '(?m)^APP_URL=.*$', "APP_URL=http://${ip}:8000")
$e = [regex]::Replace($e, '(?m)^SESSION_DOMAIN=.*$', "SESSION_DOMAIN=null")
$e = [regex]::Replace($e, '(?m)^SANCTUM_STATEFUL_DOMAINS=.*$', "SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173,${ip}:5173")
[IO.File]::WriteAllText("C:\Unix\.env", $e, $utf8)
php artisan config:clear | Out-Null

$v = "C:\Unix\frontend\vite.config.ts"
$c = [IO.File]::ReadAllText($v)
if (-not $c.Contains("host: true")) {
  $c = $c.Replace("server: {", "server: {`n    host: true,")
  [IO.File]::WriteAllText($v, $c, $utf8)
}

foreach ($port in 5173, 8000) {
  if (-not (Get-NetFirewallRule -DisplayName "Unix dev $port" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "Unix dev $port" -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
  }
}

Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location C:\Unix; php artisan serve --host=0.0.0.0 --port=8000"
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location C:\Unix\frontend; npm run dev"

Write-Host "`nSur le telephone (meme Wi-Fi) : http://${ip}:5173" -ForegroundColor Green
Get-NetConnectionProfile | ForEach-Object { "Reseau '{0}' : profil {1}" -f $_.Name, $_.NetworkCategory }