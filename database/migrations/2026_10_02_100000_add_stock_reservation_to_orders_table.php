<?php

use App\Enums\OrderStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('stock_reserved')->default(false);
            $table->timestamp('reservation_expires_at')->nullable()->index();
            $table->boolean('stock_conflict')->default(false);
        });

        // Les commandes déjà payées ont déjà consommé leur stock avec l'ancien code.
        DB::table('orders')
            ->where('status', OrderStatus::Paid->value)
            ->update(['stock_reserved' => true]);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['stock_reserved', 'reservation_expires_at', 'stock_conflict']);
        });
    }
};