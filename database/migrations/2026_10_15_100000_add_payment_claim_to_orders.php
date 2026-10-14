<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            if (! Schema::hasColumn('orders', 'payment_claimed_at')) {
                $t->timestamp('payment_claimed_at')->nullable();
            }
            if (! Schema::hasColumn('orders', 'payment_claimed_reference')) {
                $t->string('payment_claimed_reference', 100)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            $t->dropColumn(['payment_claimed_at', 'payment_claimed_reference']);
        });
    }
};