<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'cost_price')) {
            Schema::table('products', function (Blueprint $t): void {
                $t->unsignedBigInteger('cost_price')->nullable()->after('price'); // null = non renseigne
            });
        }
        if (Schema::hasTable('order_items') && ! Schema::hasColumn('order_items', 'unit_cost')) {
            Schema::table('order_items', function (Blueprint $t): void {
                $t->unsignedBigInteger('unit_cost')->nullable(); // cout copie au moment de la vente
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'cost_price')) {
            Schema::table('products', fn (Blueprint $t) => $t->dropColumn('cost_price'));
        }
        if (Schema::hasTable('order_items') && Schema::hasColumn('order_items', 'unit_cost')) {
            Schema::table('order_items', fn (Blueprint $t) => $t->dropColumn('unit_cost'));
        }
    }
};