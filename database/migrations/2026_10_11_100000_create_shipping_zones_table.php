<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_zones', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 20)->unique(); // meme code que orders.delivery_zone
            $table->string('label_fr', 100);
            $table->string('label_en', 100)->nullable();
            $table->unsignedInteger('fee')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();
        });

        $now = now();
        // Les tarifs deja modifies dans l'admin (table settings) priment sur le fichier de config
        $stored = Schema::hasTable('settings') ? DB::table('settings')->pluck('value', 'key')->all() : [];
        $pos = 0;

        foreach (config('shipping.zones') as $code => $z) {
            $override = $stored[$code.'_fee'] ?? null;

            DB::table('shipping_zones')->insert([
                'code' => $code,
                'label_fr' => $z['label'],
                'label_en' => null,
                'fee' => ($override !== null && $override !== '') ? (int) $override : (int) $z['fee'],
                'is_active' => true,
                'position' => $pos++,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('shipping_zones');
    }
};