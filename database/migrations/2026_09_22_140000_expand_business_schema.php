<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('password');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->string('guest_email')->nullable()->after('user_id');
            $table->string('guest_name')->nullable()->after('guest_email');
            $table->string('status', 32)->default('pending')->after('guest_name');
            $table->unsignedInteger('total')->default(0)->after('status');
            $table->char('currency', 3)->default('XOF')->after('total');
            $table->string('payment_transaction_id')->nullable()->unique()->after('currency');
            $table->timestamp('paid_at')->nullable()->after('payment_transaction_id');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('order_id')->after('id')->constrained()->cascadeOnDelete();
            $table->morphs('itemable');
            $table->unsignedSmallInteger('quantity')->default(1)->after('itemable_id');
            $table->unsignedInteger('unit_price')->after('quantity');
            $table->unsignedInteger('line_total')->after('unit_price');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->string('title')->after('id');
            $table->string('slug')->unique()->after('title');
            $table->text('description')->nullable()->after('slug');
            $table->unsignedInteger('price')->default(0)->after('description');
            $table->string('stream_video_id')->nullable()->after('price');
            $table->boolean('is_published')->default(false)->after('stream_video_id');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('name')->after('id');
            $table->string('slug')->unique()->after('name');
            $table->text('description')->nullable()->after('slug');
            $table->unsignedInteger('price')->default(0)->after('description');
            $table->unsignedInteger('stock')->default(0)->after('price');
            $table->boolean('is_published')->default(false)->after('stock');
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->foreignId('user_id')->after('id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->after('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('progress')->default(0)->after('course_id');
            $table->timestamp('completed_at')->nullable()->after('progress');
            $table->unique(['user_id', 'course_id']);
        });

        Schema::table('certificates', function (Blueprint $table) {
            $table->foreignId('enrollment_id')->after('id')->constrained()->cascadeOnDelete();
            $table->string('file_path')->after('enrollment_id');
            $table->timestamp('issued_at')->after('file_path');
            $table->unique('enrollment_id');
        });

        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 32);
            $table->string('event_key')->unique();
            $table->json('payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');

        Schema::table('certificates', function (Blueprint $table) {
            $table->dropUnique(['enrollment_id']);
            $table->dropConstrainedForeignId('enrollment_id');
            $table->dropColumn(['file_path', 'issued_at']);
        });

        Schema::table('enrollments', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'course_id']);
            $table->dropConstrainedForeignId('user_id');
            $table->dropConstrainedForeignId('course_id');
            $table->dropColumn(['progress', 'completed_at']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['name', 'slug', 'description', 'price', 'stock', 'is_published']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['title', 'slug', 'description', 'price', 'stream_video_id', 'is_published']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropMorphs('itemable');
            $table->dropConstrainedForeignId('order_id');
            $table->dropColumn(['quantity', 'unit_price', 'line_total']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn([
                'guest_email',
                'guest_name',
                'status',
                'total',
                'currency',
                'payment_transaction_id',
                'paid_at',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_admin');
        });
    }
};
