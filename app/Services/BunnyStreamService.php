<?php

namespace App\Services;

class BunnyStreamService
{
    private readonly string $libraryId;

    private readonly string $securityKey;

    public function __construct()
    {
        $this->libraryId = (string) config('services.bunny_stream.library_id');
        $this->securityKey = (string) config('services.bunny_stream.security_key');
    }

    /**
     * URL d'embed signée pour Bunny Stream (token authentication).
     *
     * @return array{embed_url: string, expires_at: int}
     */
    public function signedEmbedUrl(string $videoId, int $ttlSeconds = 3600): array
    {
        if ($this->libraryId === '' || $this->securityKey === '') {
            throw new \RuntimeException('Bunny Stream n\'est pas configuré.');
        }

        $expires = time() + $ttlSeconds;
        $hashable = $this->securityKey.$videoId.$expires;
        $token = hash('sha256', $hashable);

        $embedUrl = sprintf(
            'https://iframe.mediadelivery.net/embed/%s/%s?token=%s&expires=%d',
            $this->libraryId,
            $videoId,
            $token,
            $expires,
        );

        return [
            'embed_url' => $embedUrl,
            'expires_at' => $expires,
        ];
    }
}
