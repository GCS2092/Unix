<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('products')->orderBy('id')->chunkById(200, function ($products) use ($now): void {
            foreach ($products as $p) {
                $moved = (int) DB::table('stock_movements')->where('product_id', $p->id)->sum('quantity_change');
                $start = (int) $p->stock - $moved;

                if ($start === 0) {
                    continue;
                }

                $exists = DB::table('stock_movements')
                    ->where('product_id', $p->id)
                    ->where('reason', 'initial')
                    ->exists();

                if ($exists) {
                    continue;
                }

                DB::table('stock_movements')->insert([
                    'product_id' => $p->id,
                    'order_id' => null,
                    'user_id' => null,
                    'quantity_change' => $start,
                    'stock_after' => $start,
                    'reason' => 'initial',
                    'note' => 'Stock de départ reconstitué',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        });
    }

    public function down(): void
    {
        DB::table('stock_movements')
            ->where('reason', 'initial')
            ->where('note', 'Stock de départ reconstitué')
            ->delete();
    }
};