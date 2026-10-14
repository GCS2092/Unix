<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\User;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class MarkPaidDetailsTest extends TestCase
{
    use RefreshDatabase;

    public function test_records_details_and_is_idempotent(): void
    {
        Notification::fake();
        $admin = User::factory()->create();
        $order = Order::factory()->create(['status' => OrderStatus::Pending, 'total' => 5000]);
        $svc = app(OrderFulfillmentService::class);

        $svc->markPaid($order, ['method' => 'wave', 'reference' => 'W123', 'amount' => 5000, 'source' => 'manual', 'paid_by' => $admin->id]);
        $svc->markPaid($order->fresh(), ['method' => 'cash']);

        $o = $order->fresh();
        $this->assertTrue($o->isPaid());
        $this->assertSame('wave', $o->payment_method);
        $this->assertSame('W123', $o->payment_reference);
        $this->assertSame('manual', $o->payment_source);
        $this->assertSame($admin->id, (int) $o->paid_by);
        $this->assertSame(1, Invoice::query()->where('order_id', $order->id)->count());
    }

    public function test_refuses_amount_below_total(): void
    {
        Notification::fake();
        $order = Order::factory()->create(['status' => OrderStatus::Pending, 'total' => 5000]);

        $this->expectException(\RuntimeException::class);
        try {
            app(OrderFulfillmentService::class)->markPaid($order, ['amount' => 1000]);
        } finally {
            $this->assertFalse($order->fresh()->isPaid());
        }
    }

    public function test_expired_order_can_still_be_marked_paid(): void
    {
        Notification::fake();
        $order = Order::factory()->create(['status' => OrderStatus::Failed, 'total' => 5000, 'stock_reserved' => false]);

        app(OrderFulfillmentService::class)->markPaid($order, ['method' => 'transfer', 'source' => 'manual']);

        $this->assertTrue($order->fresh()->isPaid());
    }
}