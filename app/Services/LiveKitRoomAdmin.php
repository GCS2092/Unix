<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class LiveKitRoomAdmin
{
    /** Ferme la salle : tous les participants sont deconnectes. */
    public function end(string $room): void
    {
        $this->call($room, 'DeleteRoom', ['room' => $room]);
    }

    /** Donne ou retire le droit de publier (micro, camera, ecran) a un participant. */
    public function permit(string $room, string $identity, bool $allow): bool
    {
        return $this->call($room, 'UpdateParticipant', [
            'room' => $room,
            'identity' => $identity,
            'permission' => [
                'canSubscribe' => true,
                'canPublish' => $allow,
                'canPublishData' => true,
            ],
        ]);
    }

    /** Exclut un participant de la salle. */
    public function remove(string $room, string $identity): bool
    {
        return $this->call($room, 'RemoveParticipant', ['room' => $room, 'identity' => $identity]);
    }

    private function call(string $room, string $method, array $payload): bool
    {
        $key = (string) config('services.livekit.api_key');
        $secret = (string) config('services.livekit.api_secret');
        $url = (string) config('services.livekit.url');

        if ($key === '' || $secret === '' || $url === '') {
            return false;
        }

        $http = rtrim((string) preg_replace('#^ws#', 'http', $url), '/');
        $now = time();
        $jwt = JWT::encode([
            'iss' => $key,
            'sub' => 'server',
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + 60,
            'video' => ['roomCreate' => true, 'roomAdmin' => true, 'room' => $room],
        ], $secret, 'HS256');

        try {
            $res = Http::withToken($jwt)->acceptJson()->asJson()->timeout(5)
                ->post($http.'/twirp/livekit.RoomService/'.$method, $payload);

            if (! $res->successful()) {
                Log::warning("LiveKit {$method}: HTTP ".$res->status().' '.$res->body());

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning("LiveKit {$method}: ".$e->getMessage());

            return false;
        }
    }
}