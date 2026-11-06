<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_accessories', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();   // l'appareil
            $t->foreignId('accessory_id')->constrained('products')->cascadeOnDelete(); // l'accessoire compatible
            $t->boolean('is_required')->default(false);                                // indispensable ?
            $t->unsignedInteger('position')->default(0);
            $t->timestamps();

            $t->unique(['product_id', 'accessory_id']);
            $t->index('accessory_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_accessories');
    }
};