<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('phone', 30)->nullable();
            $table->string('delivery_method', 20)->nullable(); // delivery | pickup | digital
            $table->string('delivery_zone', 20)->nullable();   // dakar | regions
            $table->string('city')->nullable();
            $table->string('district')->nullable();
            $table->string('address')->nullable();
            $table->string('landmark')->nullable();
            $table->text('note')->nullable();
            $table->unsignedInteger('subtotal')->default(0);
            $table->unsignedInteger('delivery_fee')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'phone', 'delivery_method', 'delivery_zone', 'city', 'district',
                'address', 'landmark', 'note', 'subtotal', 'delivery_fee',
            ]);
        });
    }
};