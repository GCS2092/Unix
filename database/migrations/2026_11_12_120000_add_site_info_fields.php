<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipping_zones', function (Blueprint $t): void {
            if (! Schema::hasColumn('shipping_zones', 'delay_fr')) { $t->string('delay_fr', 120)->nullable(); }
            if (! Schema::hasColumn('shipping_zones', 'delay_en')) { $t->string('delay_en', 120)->nullable(); }
        });
        Schema::table('courses', function (Blueprint $t): void {
            if (! Schema::hasColumn('courses', 'level')) { $t->string('level', 20)->nullable(); }
        });
    }

    public function down(): void {}
};