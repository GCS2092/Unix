<?php

namespace Database\Factories;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'guest_email' => null,
            'guest_name' => null,
            'status' => OrderStatus::Pending,
            'total' => fake()->randomElement([5000, 15000, 20000]),
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.Str::uuid()->toString(),
            'paid_at' => null,
        ];
    }

    public function paid(): static
    {
        return $this->state(fn () => [
            'status' => OrderStatus::Paid,
            'paid_at' => now(),
        ]);
    }
}
