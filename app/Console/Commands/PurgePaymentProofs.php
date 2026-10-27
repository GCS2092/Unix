<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PurgePaymentProofs extends Command
{
    protected $signature = 'payments:purge-proofs {--days= : Duree de conservation en jours}';

    protected $description = 'Supprime les captures de paiement plus anciennes que la duree de conservation';

    public function handle(): int
    {
        $days = $this->option('days') !== null ? (int) $this->option('days') : (int) config('payment.proof_retention_days', 90);
        if ($days < 1) {
            $this->error('Duree invalide.');

            return self::FAILURE;
        }

        $cutoff = now()->subDays($days);
        $count = 0;

        Order::query()
            ->whereNotNull('payment_proof_path')
            ->where(fn ($q) => $q->whereNull('payment_proof_at')->orWhere('payment_proof_at', '<', $cutoff))
            ->chunkById(100, function ($orders) use (&$count): void {
                foreach ($orders as $order) {
                    Storage::disk('local')->delete((string) $order->payment_proof_path);
                    $order->forceFill(['payment_proof_path' => null, 'payment_proof_at' => null])->save();
                    $count++;
                }
            });

        $this->info("$count capture(s) supprimee(s).");

        return self::SUCCESS;
    }
}