<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $cols = [
        'gender' => 20, 'birth_place' => 120, 'birth_country' => 2, 'nationality' => 2,
        'country' => 2, 'city' => 120, 'address' => 255, 'profession' => 120,
    ];

    public function up(): void
    {
        Schema::table('users', function (Blueprint $t): void {
            foreach ($this->cols as $col => $len) {
                if (! Schema::hasColumn('users', $col)) {
                    $t->string($col, $len)->nullable();
                }
            }
            if (! Schema::hasColumn('users', 'birth_date')) {
                $t->date('birth_date')->nullable();
            }
        });
    }

    public function down(): void {}
};