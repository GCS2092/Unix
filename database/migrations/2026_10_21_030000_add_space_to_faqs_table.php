<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('faqs', 'space')) {
            return;
        }
        Schema::table('faqs', function (Blueprint $table): void {
            // Les questions deja creees viennent de l'espace Formation.
            $table->string('space', 20)->default('formation')->index();
        });
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};