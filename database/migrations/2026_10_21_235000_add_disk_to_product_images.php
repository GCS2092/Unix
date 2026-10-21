<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('product_images', 'disk')) {
            Schema::table('product_images', function (Blueprint $t): void {
                $t->string('disk', 30)->nullable();
            });
        }
        if (! Schema::hasColumn('products', 'image_disk')) {
            Schema::table('products', function (Blueprint $t): void {
                $t->string('image_disk', 30)->nullable();
            });
        }
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};