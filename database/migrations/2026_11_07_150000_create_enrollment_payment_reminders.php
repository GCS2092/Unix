<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('enrollment_payment_reminders')) {
            Schema::create('enrollment_payment_reminders', function (Blueprint $t): void {
                $t->id();
                $t->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
                $t->string('kind', 20); // before | due | late1 | late2 | late3
                $t->timestamp('sent_at');
                $t->timestamps();
                $t->unique(['enrollment_id', 'kind']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollment_payment_reminders');
    }
};