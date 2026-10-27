<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $t): void {
            if (! Schema::hasColumn('orders', 'payment_proof_path')) {
                $t->string('payment_proof_path', 255)->nullable();
            }
            if (! Schema::hasColumn('orders', 'payment_proof_at')) {
                $t->timestamp('payment_proof_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $t): void {
            $t->dropColumn(['payment_proof_path', 'payment_proof_at']);
        });
    }
};