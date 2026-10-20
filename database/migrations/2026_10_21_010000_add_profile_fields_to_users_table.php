<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $cols = [
        'phone' => 30, 'gender' => 10, 'birth_place' => 120, 'birth_country' => 80,
        'nationality' => 80, 'country' => 80, 'city' => 120, 'address' => 255, 'profession' => 120,
    ];

    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            foreach ($this->cols as $col => $len) {
                if (! Schema::hasColumn('users', $col)) {
                    $table->string($col, $len)->nullable();
                }
            }
            if (! Schema::hasColumn('users', 'birth_date')) {
                $table->date('birth_date')->nullable();
            }
        });
    }

    public function down(): void
    {
        // Volontairement vide : certaines colonnes peuvent exister avant cette migration.
    }
};