<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            if (! Schema::hasColumn('orders', 'payment_method')) {
                $t->string('payment_method', 40)->nullable();
            }
            $t->string('payment_reference', 100)->nullable();
            $t->string('payment_source', 20)->nullable();   // manual | gateway
            $t->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $t) {
            $t->dropConstrainedForeignId('paid_by');
            $t->dropColumn(['payment_reference', 'payment_source']);
        });
    }
};