<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('faqs')) {
            return;
        }
        Schema::create('faqs', function (Blueprint $table): void {
            $table->id();
            $table->string('category_fr', 80)->nullable();
            $table->string('category_en', 80)->nullable();
            $table->string('question_fr', 255);
            $table->text('answer_fr');
            $table->string('question_en', 255)->nullable();
            $table->text('answer_en')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->index(['is_published', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('faqs');
    }
};