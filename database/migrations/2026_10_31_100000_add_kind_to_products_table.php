<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'kind')) {
            Schema::table('products', function (Blueprint $t): void {
                $t->string('kind', 20)->default('device')->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('products', 'kind')) {
            Schema::table('products', function (Blueprint $t): void {
                $t->dropColumn('kind');
            });
        }
    }
};