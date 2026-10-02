<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoice_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last_number')->default(0);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained()->restrictOnDelete();
            $table->string('number', 30)->unique();
            $table->string('status', 20)->default('issued')->index();
            $table->timestamp('issued_at')->index();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('customer_email')->nullable();
            $table->string('customer_phone', 50)->nullable();
            $table->text('customer_address')->nullable();
            $table->string('currency', 8)->default('XOF');
            $table->bigInteger('subtotal')->default(0);
            $table->bigInteger('delivery_fee')->default(0);
            $table->bigInteger('total')->default(0);
            $table->string('locale', 5)->nullable();
            $table->json('items');
            $table->json('seller');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('invoice_sequences');
    }
};