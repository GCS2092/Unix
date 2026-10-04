<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->boolean('meeting_mode')->default(false)->after('live_started_at');
            $table->string('invite_token', 64)->nullable()->unique()->after('meeting_mode');
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropUnique(['invite_token']);
            $table->dropColumn(['meeting_mode', 'invite_token']);
        });
    }
};