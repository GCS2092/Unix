<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reminder_logs', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $t->string('type', 32);
            $t->timestamp('sent_at');
            $t->index(['enrollment_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reminder_logs');
    }
};