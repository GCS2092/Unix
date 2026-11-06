<?php

namespace App\Console\Commands;

use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Console\Command;

class BackfillReceivedStep extends Command
{
    protected $signature = 'orders:backfill-received {--apply : Applique reellement (sinon simulation)}';

    protected $description = "Met l'etape \"Recue\" sur les commandes payees (livraison/retrait) qui n'ont aucune etape de suivi.";

    public function handle(): int
    {
        $query = Order::query()
            ->where('status', OrderStatus::Paid->value)
            ->whereIn('delivery_method', ['delivery', 'pickup'])
            ->whereNull('fulfillment_status');

        $count = (clone $query)->count();

        if (! $this->option('apply')) {
            $this->info("$count commande(s) payee(s) sans etape de suivi (simulation : ajoutez --apply pour corriger).");

            return self::SUCCESS;
        }

        // Mise a jour directe : aucun e-mail, aucun evenement de chronologie
        $query->update(['fulfillment_status' => FulfillmentStatus::Received->value]);
        $this->info("$count commande(s) mise(s) a l'etape \"Recue\".");

        return self::SUCCESS;
    }
}