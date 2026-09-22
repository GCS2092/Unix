<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    public function definition(): array
    {
        $course = Course::factory()->create();
        $quantity = 1;
        $unitPrice = $course->price;

        return [
            'order_id' => Order::factory(),
            'itemable_type' => Course::class,
            'itemable_id' => $course->id,
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'line_total' => $unitPrice * $quantity,
        ];
    }
}
