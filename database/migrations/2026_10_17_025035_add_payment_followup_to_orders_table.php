<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, callable(Blueprint): mixed> */
    private function columns(): array
    {
        return [
            'payment_anomaly' => fn (Blueprint $t) => $t->string('payment_anomaly', 40)->nullable()->index(),
            'payment_anomaly_note' => fn (Blueprint $t) => $t->string('payment_anomaly_note', 500)->nullable(),
            'payment_anomaly_at' => fn (Blueprint $t) => $t->timestamp('payment_anomaly_at')->nullable(),
            'payment_claim_rejected_at' => fn (Blueprint $t) => $t->timestamp('payment_claim_rejected_at')->nullable(),
            'payment_claim_rejected_reason' => fn (Blueprint $t) => $t->string('payment_claim_rejected_reason', 300)->nullable(),
            'payment_checked_at' => fn (Blueprint $t) => $t->timestamp('payment_checked_at')->nullable(),
            'refunded_at' => fn (Blueprint $t) => $t->timestamp('refunded_at')->nullable(),
            'refund_reason' => fn (Blueprint $t) => $t->string('refund_reason', 300)->nullable(),
            'refunded_by' => fn (Blueprint $t) => $t->unsignedBigInteger('refunded_by')->nullable(),
        ];
    }

    public function up(): void
    {
        foreach ($this->columns() as $name => $define) {
            if (! Schema::hasColumn('orders', $name)) {
                Schema::table('orders', fn (Blueprint $t) => $define($t));
            }
        }
    }

    public function down(): void
    {
        foreach (array_keys($this->columns()) as $name) {
            if (Schema::hasColumn('orders', $name)) {
                Schema::table('orders', fn (Blueprint $t) => $t->dropColumn($name));
            }
        }
    }
};