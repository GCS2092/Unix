<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $t) {
            $t->unsignedInteger('duration_seconds')->nullable();
        });
        Schema::table('enrollments', function (Blueprint $t) {
            $t->unsignedInteger('watch_seconds')->default(0);
            $t->timestamp('last_heartbeat_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('enrollments', function (Blueprint $t) {
            $t->dropColumn(['watch_seconds', 'last_heartbeat_at']);
        });
        Schema::table('courses', function (Blueprint $t) {
            $t->dropColumn('duration_seconds');
        });
    }
};