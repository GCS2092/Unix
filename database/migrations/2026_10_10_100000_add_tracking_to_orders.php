<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('carrier', 80)->nullable();
            $table->string('tracking_number', 80)->nullable();
            $table->string('pickup_note', 255)->nullable();
            $table->text('serial_numbers')->nullable();
            $table->unsignedSmallInteger('warranty_months')->nullable();
            $table->timestamp('received_confirmed_at')->nullable();
            $table->string('tracking_token', 40)->nullable()->unique();
        });

        Schema::create('order_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('step', 20);
            $table->timestamps();
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['carrier', 'tracking_number', 'pickup_note', 'serial_numbers', 'warranty_months', 'received_confirmed_at', 'tracking_token']);
        });
    }
};