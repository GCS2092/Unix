<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('faqs', 'product_id')) {
            Schema::table('faqs', function (Blueprint $t): void {
                $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            });
        }
        if (! Schema::hasColumn('faqs', 'course_id')) {
            Schema::table('faqs', function (Blueprint $t): void {
                $t->foreignId('course_id')->nullable()->constrained()->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Volontairement vide.
    }
};