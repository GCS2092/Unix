<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Marqueur d'anomalie de paiement sur une commande.
 * A appeler depuis le webhook a la place d'un simple Log::critical :
 *   app(PaymentAnomalyService::class)->flag($order, 'amount_mismatch', 'Recu 5000, attendu 7500');
 */
class PaymentAnomalyService
{
    public const AMOUNT_MISMATCH = 'amount_mismatch';

    public const STOCK_MISSING = 'stock_missing';

    public const OTHER = 'other';

    public function __construct(private readonly ActivityLogger $activity) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function flag(Order $order, string $type, string $note, array $context = [], ?User $actor = null): void
    {
        $order->forceFill([
            'payment_anomaly' => $type,
            'payment_anomaly_note' => mb_substr($note, 0, 500),
            'payment_anomaly_at' => now(),
        ])->save();

        // On garde la trace dans les logs pour l'exploitation, en plus du marqueur visible dans l'admin
        Log::critical('Anomalie de paiement', ['order_id' => $order->getKey(), 'type' => $type, 'note' => $note] + $context);

        try {
            $this->activity->log($actor, 'order.payment_anomaly_flagged', $order, ['type' => $type, 'note' => $note] + $context);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function clear(Order $order, ?User $actor = null, ?string $note = null): void
    {
        $previous = $order->getAttribute('payment_anomaly');

        if ($previous === null) {
            return;
        }

        $order->forceFill([
            'payment_anomaly' => null,
            'payment_anomaly_note' => null,
            'payment_anomaly_at' => null,
        ])->save();

        try {
            $this->activity->log($actor, 'order.payment_anomaly_resolved', $order, ['type' => $previous, 'note' => $note]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}