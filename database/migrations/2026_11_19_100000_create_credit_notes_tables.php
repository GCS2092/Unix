<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credit_note_sequences', function (Blueprint $table) {
            $table->unsignedSmallInteger('year')->primary();
            $table->unsignedInteger('last_number')->default(0);
        });

        Schema::create('credit_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->string('number', 30)->unique();
            $table->timestamp('issued_at')->index();
            $table->string('reason', 500)->nullable();
            $table->string('customer_name')->nullable();
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
        Schema::dropIfExists('credit_notes');
        Schema::dropIfExists('credit_note_sequences');
    }
};