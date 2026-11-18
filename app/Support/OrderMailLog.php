<?php

namespace App\Support;

use App\Models\Order;
use Illuminate\Support\Facades\DB;

/** Garde la trace de l'issue de chaque e-mail lie a une commande (queued, no_email, failed). Ne leve jamais d'exception. */
class OrderMailLog
{
    public static function record(Order $order, string $kind, string $outcome, ?string $email = null, ?string $error = null): void
    {
        try {
            DB::table('order_mail_logs')->insert([
                'order_id' => $order->id,
                'kind' => substr($kind, 0, 40),
                'outcome' => substr($outcome, 0, 20),
                'email' => $email !== null ? substr($email, 0, 190) : null,
                'error' => $error !== null ? substr($error, 0, 500) : null,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}