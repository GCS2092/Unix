<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('course_images')) {
            return;
        }
        Schema::create('course_images', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->string('path', 255);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
            $table->index(['course_id', 'position']);
        });
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};