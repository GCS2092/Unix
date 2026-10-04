<?php

namespace App\Console\Commands;

use Firebase\JWT\JWT;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class LiveKitCheck extends Command
{
    protected $signature = 'livekit:check';

    protected $description = 'Verifie la configuration et la connexion au serveur LiveKit';

    public function handle(): int
    {
        $key = (string) config('services.livekit.api_key');
        $secret = (string) config('services.livekit.api_secret');
        $url = (string) config('services.livekit.url');

        $this->line('URL     : '.($url !== '' ? $url : 'VIDE'));
        $this->line('API key : '.($key !== '' ? substr($key, 0, 4).'...' : 'VIDE'));
        $this->line('Secret  : '.($secret !== '' ? 'present ('.strlen($secret).' caracteres)' : 'VIDE'));

        if ($key === '' || $secret === '' || $url === '') {
            $this->error('Configuration incomplete : verifiez config/services.php et le .env (puis php artisan config:clear).');

            return self::FAILURE;
        }

        if (! str_starts_with($url, 'wss://') && ! str_starts_with($url, 'ws://')) {
            $this->warn('LIVEKIT_URL devrait commencer par wss:// (le navigateur se connecte en WebSocket).');
        }

        $now = time();
        $jwt = JWT::encode([
            'iss' => $key, 'sub' => 'check', 'iat' => $now, 'nbf' => $now, 'exp' => $now + 60,
            'video' => ['roomList' => true],
        ], $secret, 'HS256');

        $http = rtrim((string) preg_replace('#^ws#', 'http', $url), '/');

        try {
            $res = Http::withToken($jwt)->acceptJson()->timeout(8)
                ->withBody('{}', 'application/json')
                ->post($http.'/twirp/livekit.RoomService/ListRooms');
        } catch (\Throwable $e) {
            $this->error('Serveur injoignable : '.$e->getMessage());

            return self::FAILURE;
        }

        if ($res->successful()) {
            $n = count($res->json('rooms') ?? []);
            $this->info("OK : serveur LiveKit joignable, cles acceptees ({$n} salle(s) active(s)).");

            return self::SUCCESS;
        }

        $this->error('Refuse par le serveur (HTTP '.$res->status().') : cles ou URL incorrectes ?');
        $this->line($res->body());

        return self::FAILURE;
    }
}