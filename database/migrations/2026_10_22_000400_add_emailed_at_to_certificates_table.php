<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('certificates', 'emailed_at')) {
            Schema::table('certificates', function (Blueprint $t): void {
                $t->timestamp('emailed_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};