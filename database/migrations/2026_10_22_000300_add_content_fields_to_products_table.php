<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['specs', 'specs_en', 'delivery_info', 'delivery_info_en'] as $col) {
            if (! Schema::hasColumn('products', $col)) {
                Schema::table('products', function (Blueprint $t) use ($col): void {
                    $t->text($col)->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};