<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CinetPayService
{
    private const INIT_URL = 'https://api-checkout.cinetpay.com/v2/payment';

    private const CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';

    private readonly string $apiKey;

    private readonly string $siteId;

    public function __construct()
    {
        $this->apiKey = (string) config('services.cinetpay.api_key', '');
        $this->siteId = (string) config('services.cinetpay.site_id', '');
    }

    /**
     * Initie un paiement et renvoie l'URL de paiement CinetPay.
     *
     * @return array<string, mixed>
     */
    public function initiatePayment(
        string $transactionId,
        int $amount,
        string $description,
        string $currency = 'XOF',
    ): array {
        $response = Http::asJson()->post(self::INIT_URL, [
            'apikey' => $this->apiKey,
            'site_id' => $this->siteId,
            'transaction_id' => $transactionId,
            'amount' => $amount,
            'currency' => $currency,
            'description' => $description,
            'notify_url' => route('cinetpay.notify'),
            'return_url' => route('cinetpay.return'),
            'channels' => 'ALL',
        ]);

        if ($response->failed()) {
            Log::error('CinetPay init failed', [
                'status' => $response->status(),
                'response' => $response->json(),
            ]);

            throw new \RuntimeException(
                'Impossible d\'initier le paiement CinetPay.'
            );
        }

        return $response->json();
    }

    /**
     * Verifie le statut reel d'une transaction aupres de CinetPay.
     *
     * @return array<string, mixed>
     */
    public function checkTransactionStatus(string $transactionId): array
    {
        $response = Http::asJson()->post(self::CHECK_URL, [
            'apikey' => $this->apiKey,
            'site_id' => $this->siteId,
            'transaction_id' => $transactionId,
        ]);

        if ($response->failed()) {
            Log::error('CinetPay check failed', [
                'status' => $response->status(),
                'response' => $response->json(),
            ]);

            throw new \RuntimeException(
                'Impossible de verifier la transaction CinetPay.'
            );
        }

        return $response->json();
    }
}
