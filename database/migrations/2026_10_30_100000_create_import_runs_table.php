<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_runs', function (Blueprint $t): void {
            $t->id();
            $t->unsignedBigInteger('user_id')->nullable()->index();
            $t->string('kind', 40);
            $t->string('path');
            $t->string('ext', 10);
            $t->json('options')->nullable();
            $t->string('status', 20)->default('queued')->index();
            $t->json('report')->nullable();
            $t->text('error')->nullable();
            $t->timestamp('started_at')->nullable();
            $t->timestamp('finished_at')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_runs');
    }
};