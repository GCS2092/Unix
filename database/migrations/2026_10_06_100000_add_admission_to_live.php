<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->boolean('require_admission')->default(false)->after('meeting_mode');
        });

        Schema::create('live_join_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('secret_hash', 64);
            $table->string('status', 12)->default('pending');
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
            $table->index(['course_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_join_requests');

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('require_admission');
        });
    }
};