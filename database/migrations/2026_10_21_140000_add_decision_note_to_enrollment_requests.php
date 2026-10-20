<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('enrollment_requests', function (Blueprint $t): void {
            $t->string('decision_note', 300)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('enrollment_requests', function (Blueprint $t): void {
            $t->dropColumn('decision_note');
        });
    }
};