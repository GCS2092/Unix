<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('courses', 'cover_image')) {
            return;
        }
        Schema::table('courses', function (Blueprint $table): void {
            $table->string('cover_image', 255)->nullable();
        });
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};