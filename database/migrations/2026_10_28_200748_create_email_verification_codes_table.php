<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_verification_codes')) {
            return;
        }

        Schema::create('email_verification_codes', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('code_hash', 64);
            $t->timestamp('code_expires_at');
            $t->unsignedTinyInteger('attempts')->default(0);
            $t->string('token_hash', 64)->nullable();
            $t->timestamp('token_expires_at')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_verification_codes');
    }
};