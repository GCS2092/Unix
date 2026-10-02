<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockFrontendContractTest extends TestCase
{
    use RefreshDatabase;

    private function order(OrderStatus $status, array $extra = []): Order
    {
        $order = Order::query()->create([
            'user_id' => User::factory()->create()->id,
            'status' => $status,
            'total' => 1000,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.Str::uuid()->toString(),
        ]);

        if ($extra !== []) {
            $order->forceFill($extra)->save();
        }

        return $order;
    }

    public function test_badges_count_stock_conflicts(): void
    {
        $this->order(OrderStatus::Paid, ['stock_conflict' => true, 'paid_at' => now()]);
        $this->order(OrderStatus::Paid, ['paid_at' => now()]);

        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->getJson('/api/v1/admin/dashboard/badges')
            ->assertOk()
            ->assertJsonPath('data.orders_stock_conflict', 1);
    }

    public function test_checkout_status_exposes_reservation_expiry_only_while_pending(): void
    {
        $pending = $this->order(OrderStatus::Pending, [
            'stock_reserved' => true,
            'reservation_expires_at' => now()->addMinutes(20),
        ]);
        $paid = $this->order(OrderStatus::Paid, ['paid_at' => now()]);

        $res = $this->getJson('/api/v1/checkout/status?transaction_id='.$pending->payment_transaction_id)->assertOk();
        $this->assertNotNull($res->json('data.reservation_expires_at'));

        $res = $this->getJson('/api/v1/checkout/status?transaction_id='.$paid->payment_transaction_id)->assertOk();
        $this->assertNull($res->json('data.reservation_expires_at'));
    }
}
