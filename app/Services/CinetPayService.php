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
        $this->apiKey = config('services.cinetpay.api_key');
        $this->siteId = config('services.cinetpay.site_id');
    }

    /**
     * Initie un paiement et renvoie l'URL de paiement CinetPay a rediriger.
     *
     * @param  string  $transactionId  Identifiant unique cote Order (ex: order->id)
     * @param  int  $amount  Montant, doit etre un multiple de 5
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
            Log::error('CinetPay init failed', ['response' => $response->json()]);
            throw new \RuntimeException('Impossible d\'initier le paiement CinetPay.');
        }

        return $response->json();
    }

    /**
     * Verifie le statut REEL d'une transaction aupres de CinetPay.
     * A appeler systematiquement depuis le webhook, jamais faire confiance
     * au contenu brut recu sur notify_url.
     */
    public function checkTransactionStatus(string $transactionId): array
    {
        $response = Http::asJson()->post(self::CHECK_URL, [
            'apikey' => $this->apiKey,
            'site_id' => $this->siteId,
            'transaction_id' => $transactionId,
        ]);

        if ($response->failed()) {
            Log::error('CinetPay check failed', ['response' => $response->json()]);
            throw new \RuntimeException('Impossible de verifier la transaction CinetPay.');
        }

        return $response->json();
    }
}