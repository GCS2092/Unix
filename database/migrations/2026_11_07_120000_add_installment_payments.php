<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $t): void {
            if (! Schema::hasColumn('courses', 'deposit_type')) {
                $t->string('deposit_type', 10)->default('none'); // none | fixed | percent
            }
            if (! Schema::hasColumn('courses', 'deposit_value')) {
                $t->unsignedInteger('deposit_value')->default(0);
            }
            if (! Schema::hasColumn('courses', 'balance_due_days')) {
                $t->unsignedSmallInteger('balance_due_days')->nullable();
            }
        });

        Schema::table('enrollments', function (Blueprint $t): void {
            if (! Schema::hasColumn('enrollments', 'agreed_price')) {
                $t->unsignedInteger('agreed_price')->nullable(); // prix fige a l'inscription
            }
            if (! Schema::hasColumn('enrollments', 'payment_tracked')) {
                $t->boolean('payment_tracked')->default(false); // false = inscription anterieure, reputee soldee
            }
        });

        if (! Schema::hasTable('enrollment_payments')) {
            Schema::create('enrollment_payments', function (Blueprint $t): void {
                $t->id();
                $t->foreignId('enrollment_id')->constrained()->cascadeOnDelete();
                $t->unsignedInteger('amount');
                $t->string('method', 30);
                $t->string('reference', 120)->nullable();
                $t->timestamp('paid_at');
                $t->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                $t->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
                $t->string('note', 255)->nullable();
                $t->timestamps();
                $t->index(['enrollment_id', 'paid_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollment_payments');
        // Colonnes ajoutees volontairement conservees (comme les autres migrations du projet).
    }
};