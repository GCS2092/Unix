<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckIntegrations extends Command
{
    protected $signature = 'app:check-integrations';

    protected $description = 'Verifie que les services externes (CinetPay, LiveKit, Bunny Stream, R2) sont correctement configures';

    public function handle(): int
    {
        $checks = [
            'CinetPay' => [
                'CINETPAY_API_KEY' => config('services.cinetpay.api_key'),
                'CINETPAY_SITE_ID' => config('services.cinetpay.site_id'),
            ],
            'LiveKit' => [
                'LIVEKIT_API_KEY' => config('services.livekit.api_key'),
                'LIVEKIT_API_SECRET' => config('services.livekit.api_secret'),
                'LIVEKIT_WS_URL' => config('services.livekit.ws_url'),
            ],
            'Bunny Stream' => [
                'BUNNY_STREAM_LIBRARY_ID' => config('services.bunny_stream.library_id'),
                'BUNNY_STREAM_SECURITY_KEY' => config('services.bunny_stream.security_key'),
            ],
            'Cloudflare R2' => [
                'R2_ACCESS_KEY_ID' => config('filesystems.disks.r2.key'),
                'R2_SECRET_ACCESS_KEY' => config('filesystems.disks.r2.secret'),
                'R2_BUCKET' => config('filesystems.disks.r2.bucket'),
                'R2_ENDPOINT' => config('filesystems.disks.r2.endpoint'),
            ],
        ];

        $allOk = true;

        foreach ($checks as $service => $keys) {
            $this->line('');
            $this->line('<fg=cyan>'.$service.'</>');

            $serviceOk = true;

            foreach ($keys as $name => $value) {
                $isSet = filled($value);
                $serviceOk = $serviceOk && $isSet;
                $allOk = $allOk && $isSet;

                $icon = $isSet ? '<fg=green>OK</>' : '<fg=red>MANQUANT</>';
                $this->line('  '.$icon.'  '.$name);
            }

            if (! $serviceOk) {
                $this->line('  <fg=yellow>-> Ce service ne fonctionnera pas tant que ces cles ne sont pas renseignees.</>');
            }
        }

        $this->line('');

        if ($allOk) {
            $this->info('Tous les services externes sont correctement configures.');

            return self::SUCCESS;
        }

        $this->warn('Certains services externes ne sont pas configures. Les fonctionnalites concernees sont degradees ou indisponibles, mais le reste de l\'application fonctionne normalement.');

        return self::SUCCESS;
    }
}
