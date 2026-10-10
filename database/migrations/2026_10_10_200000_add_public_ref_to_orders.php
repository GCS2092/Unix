<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('public_ref', 16)->nullable()->unique();
        });

        // Identifiant lisible (CMD-XXXX-XXXX) pour les commandes deja existantes
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        foreach (DB::table('orders')->whereNull('public_ref')->pluck('id') as $id) {
            do {
                $code = '';
                for ($i = 0; $i < 8; $i++) {
                    $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
                }
                $ref = 'CMD-'.substr($code, 0, 4).'-'.substr($code, 4);
            } while (DB::table('orders')->where('public_ref', $ref)->exists());

            DB::table('orders')->where('id', $id)->update(['public_ref' => $ref]);
        }
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropUnique(['public_ref']);
            $table->dropColumn('public_ref');
        });
    }
};