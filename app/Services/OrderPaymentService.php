<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentWebhookEvent;
use Illuminate\Support\Facades\Log;

class OrderPaymentService
{
    public function __construct(
        private readonly CinetPayService $cinetPay,
        private readonly OrderFulfillmentService $fulfillment,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function initiatePayment(Order $order): array
    {
        $response = $this->cinetPay->initiatePayment(
            $order->payment_transaction_id,
            $order->total,
            'Commande #'.$order->id,
            $order->currency,
        );

        $paymentUrl = data_get($response, 'data.payment_url')
            ?? data_get($response, 'data.paymentUrl');

        if ($paymentUrl === null) {
            throw new \RuntimeException('URL de paiement CinetPay introuvable.');
        }

        return [
            'payment_url' => $paymentUrl,
            'transaction_id' => $order->payment_transaction_id,
            'raw' => $response,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function handleCinetPayNotification(array $payload): void
    {
        $transactionId = (string) (
            data_get($payload, 'cpm_trans_id')
            ?? data_get($payload, 'transaction_id')
            ?? ''
        );

        if ($transactionId === '') {
            Log::warning('Webhook CinetPay sans transaction_id', ['payload' => $payload]);

            return;
        }

        $eventKey = 'cinetpay:'.$transactionId.':'.md5(json_encode($payload));

        if (PaymentWebhookEvent::query()->where('event_key', $eventKey)->exists()) {
            return;
        }

        PaymentWebhookEvent::query()->create([
            'provider' => 'cinetpay',
            'event_key' => $eventKey,
            'payload' => $payload,
        ]);

        $order = Order::query()
            ->where('payment_transaction_id', $transactionId)
            ->first();

        if ($order === null) {
            Log::warning('Commande introuvable pour transaction CinetPay', [
                'transaction_id' => $transactionId,
            ]);

            return;
        }

        $check = $this->cinetPay->checkTransactionStatus($transactionId);
        $status = strtoupper((string) data_get($check, 'data.status'));

        if ($status === 'ACCEPTED') {
            $this->fulfillment->markPaid($order);

            return;
        }

        if (in_array($status, ['REFUSED', 'CANCELLED', 'FAILED'], true)) {
            $this->fulfillment->markFailed($order);
        }
    }
}
