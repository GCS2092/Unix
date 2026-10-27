<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $t): void {
            if (! Schema::hasColumn('orders', 'payment_claimed_method')) {
                $t->string('payment_claimed_method', 20)->nullable();
            }
            if (! Schema::hasColumn('orders', 'payment_claimed_last4')) {
                $t->string('payment_claimed_last4', 4)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $t): void {
            $t->dropColumn(['payment_claimed_method', 'payment_claimed_last4']);
        });
    }
};