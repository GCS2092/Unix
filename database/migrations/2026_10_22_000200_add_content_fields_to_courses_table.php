<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TEXT = [
        'description_en', 'objectives', 'objectives_en', 'program', 'program_en',
        'audience', 'audience_en', 'prerequisites', 'prerequisites_en',
    ];

    public function up(): void
    {
        if (! Schema::hasColumn('courses', 'title_en')) {
            Schema::table('courses', function (Blueprint $t): void {
                $t->string('title_en', 255)->nullable();
            });
        }
        foreach (self::TEXT as $col) {
            if (! Schema::hasColumn('courses', $col)) {
                Schema::table('courses', function (Blueprint $t) use ($col): void {
                    $t->text($col)->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};