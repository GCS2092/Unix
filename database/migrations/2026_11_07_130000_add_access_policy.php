<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $t): void {
            if (! Schema::hasColumn('courses', 'access_policy')) {
                $t->string('access_policy', 10)->default('always'); // always | deposit | settled
            }
        });
        Schema::table('enrollments', function (Blueprint $t): void {
            if (! Schema::hasColumn('enrollments', 'access_override')) {
                $t->string('access_override', 10)->nullable(); // granted | blocked | null = regle de la formation
            }
        });
    }

    public function down(): void
    {
        // Colonnes volontairement conservees.
    }
};