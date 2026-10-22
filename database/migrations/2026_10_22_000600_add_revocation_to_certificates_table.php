<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('certificates', 'revoked_at')) {
            Schema::table('certificates', function (Blueprint $t): void {
                $t->timestamp('revoked_at')->nullable();
            });
        }
        if (! Schema::hasColumn('certificates', 'revoked_reason')) {
            Schema::table('certificates', function (Blueprint $t): void {
                $t->string('revoked_reason', 255)->nullable();
            });
        }
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};