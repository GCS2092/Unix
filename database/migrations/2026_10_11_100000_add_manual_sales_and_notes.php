<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $t): void {
            if (! Schema::hasColumn('orders', 'source')) {
                $t->string('source', 20)->nullable()->index();
            }
            if (! Schema::hasColumn('orders', 'payment_method')) {
                $t->string('payment_method', 20)->nullable();
            }
            if (! Schema::hasColumn('orders', 'created_by')) {
                $t->unsignedBigInteger('created_by')->nullable();
            }
        });

        if (! Schema::hasTable('order_notes')) {
            Schema::create('order_notes', function (Blueprint $t): void {
                $t->id();
                $t->unsignedBigInteger('order_id')->index();
                $t->unsignedBigInteger('user_id')->nullable();
                $t->text('body');
                $t->timestamps();
            });
        }

        if (! Schema::hasTable('customer_notes')) {
            Schema::create('customer_notes', function (Blueprint $t): void {
                $t->id();
                $t->string('customer_key', 190)->index();
                $t->unsignedBigInteger('user_id')->nullable();
                $t->text('body');
                $t->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_notes');
        Schema::dropIfExists('order_notes');
    }
};