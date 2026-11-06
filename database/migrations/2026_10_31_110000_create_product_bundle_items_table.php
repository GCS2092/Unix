<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_bundle_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('bundle_id')->constrained('products')->cascadeOnDelete();
            // Un composant vendu dans un pack ne peut pas etre supprime : sinon le stock du pack serait faux.
            $t->foreignId('component_id')->constrained('products')->restrictOnDelete();
            $t->unsignedInteger('quantity')->default(1);
            $t->unsignedInteger('position')->default(0);
            $t->timestamps();

            $t->unique(['bundle_id', 'component_id']);
            $t->index('component_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_bundle_items');
    }
};