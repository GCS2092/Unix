<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLES = ['addresses', 'orders', 'shipping_zones'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (! Schema::hasColumn($table, 'country')) {
                Schema::table($table, fn (Blueprint $t) => $t->string('country', 2)->default('SN'));
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasColumn($table, 'country')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropColumn('country'));
            }
        }
    }
};