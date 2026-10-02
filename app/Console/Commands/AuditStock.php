<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AuditStock extends Command
{
    protected $signature = 'stock:audit';

    protected $description = 'Vérifie que le stock de chaque produit égale la somme de ses mouvements';

    public function handle(): int
    {
        $bad = DB::table('products as p')
            ->leftJoin('stock_movements as m', 'm.product_id', '=', 'p.id')
            ->groupBy('p.id', 'p.name', 'p.stock')
            ->havingRaw('p.stock <> COALESCE(SUM(m.quantity_change), 0)')
            ->select('p.id', 'p.name', 'p.stock', DB::raw('COALESCE(SUM(m.quantity_change), 0) as moved'))
            ->get();

        if ($bad->isEmpty()) {
            $this->info('Stock cohérent : chaque produit égale la somme de ses mouvements.');

            return self::SUCCESS;
        }

        $this->error($bad->count().' produit(s) en écart :');
        $this->table(
            ['ID', 'Produit', 'Stock', 'Somme des mouvements', 'Écart'],
            $bad->map(fn ($r) => [$r->id, $r->name, $r->stock, $r->moved, $r->stock - $r->moved])->all(),
        );

        return self::FAILURE;
    }
}