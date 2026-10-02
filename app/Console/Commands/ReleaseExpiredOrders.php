<?php

namespace App\Console\Commands;

use App\Services\OrderFulfillmentService;
use Illuminate\Console\Command;

class ReleaseExpiredOrders extends Command
{
    protected $signature = 'orders:release-expired';

    protected $description = 'Remet en vente le stock des commandes en attente dont la réservation a expiré';

    public function handle(OrderFulfillmentService $orders): int
    {
        $count = $orders->releaseExpired();
        $this->info("{$count} commande(s) expirée(s), stock remis en vente.");

        return self::SUCCESS;
    }
}