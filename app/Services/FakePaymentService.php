<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Facades\Cache;

/**
 * Simulation locale d'une passerelle de paiement (développement uniquement).
 */
class FakePaymentService implements PaymentGateway
{
    public function initiatePayment(string $transactionId, int $amount, string $description, string $currency = 'XOF'): array
    {
        Cache::forget("fake_payment:{$transactionId}");

        return [
            'code' => '201',
            'data' => [
                'payment_url' => route('payment.fake.show', ['transaction' => $transactionId]),
            ],
        ];
    }

    public function checkTransactionStatus(string $transactionId): array
    {
        $order = Order::query()->where('payment_transaction_id', $transactionId)->first();

        return [
            'code' => '00',
            'data' => [
                'status' => Cache::get("fake_payment:{$transactionId}", 'WAITING_FOR_CUSTOMER'),
                'amount' => $order?->total ?? 0,
                'currency' => $order?->currency ?? 'XOF',
            ],
        ];
    }
}