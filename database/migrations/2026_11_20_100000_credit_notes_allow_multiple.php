<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credit_notes', function (Blueprint $table) {
            $table->dropUnique(['invoice_id']);
            $table->index('invoice_id');
            $table->string('kind', 20)->default('cancellation');
        });
    }

    public function down(): void
    {
        Schema::table('credit_notes', function (Blueprint $table) {
            $table->dropIndex(['invoice_id']);
            $table->dropColumn('kind');
            $table->unique('invoice_id');
        });
    }
};