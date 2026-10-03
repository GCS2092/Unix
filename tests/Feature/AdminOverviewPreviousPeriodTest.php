<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOverviewPreviousPeriodTest extends TestCase
{
    use RefreshDatabase;

    private function paidOrder(int $daysAgo): void
    {
        $order = Order::query()->create([
            'guest_email' => 'c'.uniqid().'@example.com',
            'guest_name' => 'Client',
            'status' => OrderStatus::Paid,
            'total' => 1000,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.uniqid(),
            'paid_at' => now(),
        ]);

        DB::table('orders')->where('id', $order->id)->update(['created_at' => now()->subDays($daysAgo)]);
    }

    public function test_previous_period_is_returned_for_comparison(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->paidOrder(1);
        $this->paidOrder(40);
        $this->paidOrder(45);

        $this->getJson('/api/v1/admin/overview?range=30d')
            ->assertOk()
            ->assertJsonPath('data.orders.total', 1)
            ->assertJsonPath('data.previous.orders', 2)
            ->assertJsonPath('data.previous.paid', 2)
            ->assertJsonPath('data.previous.revenue', 2000)
            ->assertJsonStructure(['data' => ['generated_at']]);
    }

    public function test_all_range_has_no_previous_period(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->getJson('/api/v1/admin/overview?range=all')
            ->assertOk()
            ->assertJsonPath('data.previous', null);
    }
}