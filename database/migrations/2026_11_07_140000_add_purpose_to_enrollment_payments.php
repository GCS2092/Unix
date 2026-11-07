<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollment_payments', function (Blueprint $t): void {
            if (! Schema::hasColumn('enrollment_payments', 'purpose')) {
                $t->string('purpose', 20)->default('other'); // deposit | balance | full | registration | previous | other
            }
        });
    }

    public function down(): void
    {
        // Colonne volontairement conservee.
    }
};