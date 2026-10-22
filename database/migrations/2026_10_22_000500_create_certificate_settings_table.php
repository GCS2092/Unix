<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('certificate_settings')) {
            return;
        }
        Schema::create('certificate_settings', function (Blueprint $t): void {
            $t->id();
            $t->string('key', 40)->unique();
            $t->text('value')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};