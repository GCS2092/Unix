<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quizzes', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('course_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('title', 160)->nullable();
            $t->unsignedTinyInteger('passing_score')->default(70);
            $t->unsignedTinyInteger('max_attempts')->default(3);
            $t->boolean('is_published')->default(false);
            $t->timestamps();
        });

        Schema::create('quiz_questions', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $t->text('prompt');
            $t->json('options');
            $t->unsignedTinyInteger('correct_index');
            $t->unsignedSmallInteger('position')->default(0);
            $t->timestamps();
        });

        Schema::create('quiz_attempts', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('quiz_id')->constrained()->cascadeOnDelete();
            $t->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
            $t->unsignedTinyInteger('score');
            $t->boolean('passed')->default(false);
            $t->json('answers')->nullable();
            $t->timestamps();
            $t->index(['enrollment_id', 'quiz_id']);
        });

        Schema::table('certificates', function (Blueprint $t): void {
            $t->string('code', 16)->nullable()->unique();
        });

        foreach (DB::table('certificates')->whereNull('code')->pluck('id') as $id) {
            DB::table('certificates')->where('id', $id)->update(['code' => Str::upper(Str::random(10))]);
        }
    }

    public function down(): void
    {
        Schema::table('certificates', function (Blueprint $t): void {
            $t->dropUnique(['code']);
            $t->dropColumn('code');
        });
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
    }
};