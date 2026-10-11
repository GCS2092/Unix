<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refunds', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete(); // admin
            $table->unsignedInteger('amount');
            $table->string('reason', 255)->nullable();
            $table->boolean('restock')->default(false);
            $table->timestamps();
            $table->index('order_id');
        });

        Schema::create('refund_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('refund_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('quantity');
            $table->unsignedInteger('amount');
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table): void {
            $table->unsignedInteger('refunded_total')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('refunded_total');
        });
        Schema::dropIfExists('refund_items');
        Schema::dropIfExists('refunds');
    }
};
