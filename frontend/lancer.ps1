Set-Location C:\Unix
$utf8 = New-Object Text.UTF8Encoding($false)

# IP Wi-Fi/Ethernet actuelle
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" } | Select-Object -First 1).IPAddress
if (-not $ip) { throw "Aucune adresse reseau locale trouvee." }

# .env
$env_ = [IO.File]::ReadAllText("C:\Unix\.env")
$env_ = [regex]::Replace($env_, '(?m)^APP_URL=.*$', "APP_URL=http://${ip}:8000")
$env_ = [regex]::Replace($env_, '(?m)^SESSION_DOMAIN=.*$', "SESSION_DOMAIN=null")
$env_ = [regex]::Replace($env_, '(?m)^SANCTUM_STATEFUL_DOMAINS=.*$', "SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173,${ip}:5173")
[IO.File]::WriteAllText("C:\Unix\.env", $env_, $utf8)
php artisan config:clear | Out-Null

# Vite : ecouter sur le reseau
$v = "C:\Unix\frontend\vite.config.ts"
$c = [IO.File]::ReadAllText($v)
if (-not $c.Contains("host: true")) {
  $c = $c.Replace("server: {", "server: {`n    host: true,")
  [IO.File]::WriteAllText($v, $c, $utf8)
}

# Pare-feu (reseau prive uniquement)
foreach ($port in 5173, 8000) {
  if (-not (Get-NetFirewallRule -DisplayName "Unix dev $port" -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName "Unix dev $port" -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
  }
}

# Laravel + front dans deux fenetres
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location C:\Unix; php artisan serve --host=0.0.0.0 --port=8000"
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location C:\Unix\frontend; npm run dev"

Write-Host "`nSur le telephone (meme Wi-Fi) : http://${ip}:5173" -ForegroundColor Green