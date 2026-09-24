<?php

namespace App\Services;

use Firebase\JWT\JWT;

class LiveKitService
{
    /**
     * @return array{token: string, url: string, room: string, identity: string, expires_at: int}
     */
    public function createRoomToken(string $room, string $identity, int $ttlSeconds = 3600): array
    {
        $apiKey = (string) config('services.livekit.api_key');
        $apiSecret = (string) config('services.livekit.api_secret');
        $wsUrl = (string) config('services.livekit.url');

        if ($apiKey === '' || $apiSecret === '' || $wsUrl === '') {
            throw new \RuntimeException('LiveKit n\'est pas configuré.');
        }

        $now = time();
        $expires = $now + $ttlSeconds;

        $payload = [
            'iss' => $apiKey,
            'sub' => $identity,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $expires,
            'video' => [
                'roomJoin' => true,
                'room' => $room,
            ],
        ];

        $token = JWT::encode($payload, $apiSecret, 'HS256');

        return [
            'token' => $token,
            'url' => $wsUrl,
            'room' => $room,
            'identity' => $identity,
            'expires_at' => $expires,
        ];
    }
}
