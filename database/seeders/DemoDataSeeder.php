<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        $student = User::query()->updateOrCreate(
            ['email' => 'student@example.com'],
            [
                'name' => 'Étudiant Démo',
                'password' => bcrypt('password'),
            ],
        );

        $course = Course::query()->where('slug', 'introduction-laravel')->first();
        $product = Product::query()->where('slug', 'cahier-formation-papier')->first();

        if (! $course || ! $product) {
            return;
        }

        Enrollment::query()->updateOrCreate(
            [
                'user_id' => $student->id,
                'course_id' => $course->id,
            ],
            [
                'progress' => 35,
                'completed_at' => null,
            ],
        );

        $paidOrder = Order::query()->updateOrCreate(
            ['payment_transaction_id' => 'ORD-DEMO-PAID-001'],
            [
                'user_id' => $student->id,
                'status' => OrderStatus::Paid,
                'total' => $course->price + $product->price,
                'currency' => 'XOF',
                'paid_at' => now()->subDay(),
            ],
        );

        OrderItem::query()->updateOrCreate(
            [
                'order_id' => $paidOrder->id,
                'itemable_type' => Course::class,
                'itemable_id' => $course->id,
            ],
            [
                'quantity' => 1,
                'unit_price' => $course->price,
                'line_total' => $course->price,
            ],
        );

        OrderItem::query()->updateOrCreate(
            [
                'order_id' => $paidOrder->id,
                'itemable_type' => Product::class,
                'itemable_id' => $product->id,
            ],
            [
                'quantity' => 1,
                'unit_price' => $product->price,
                'line_total' => $product->price,
            ],
        );
    }
}
