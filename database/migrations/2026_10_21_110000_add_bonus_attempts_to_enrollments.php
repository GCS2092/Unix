<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollments', function (Blueprint $t): void {
            $t->unsignedTinyInteger('bonus_attempts')->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $t): void {
            $t->dropColumn('bonus_attempts');
        });
    }
};