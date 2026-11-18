<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Services\AdminAlerts;
use App\Support\OrderMailLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OrderMailLogTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(array $attrs = []): Order
    {
        return Order::query()->create($attrs + [
            'status' => OrderStatus::Paid,
            'total' => 10000,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.uniqid(),
        ]);
    }

    public function test_record_writes_a_row(): void
    {
        $order = $this->makeOrder();

        OrderMailLog::record($order, 'paid', 'no_email');

        $this->assertDatabaseHas('order_mail_logs', ['order_id' => $order->id, 'kind' => 'paid', 'outcome' => 'no_email']);
    }

    public function test_admin_alert_is_logged(): void
    {
        Notification::fake();
        User::factory()->create(['is_admin' => true, 'email' => 'admin@example.org']);
        $order = $this->makeOrder(['guest_email' => 'client@example.org']);

        app(AdminAlerts::class)->orderPaid($order);

        $this->assertDatabaseHas('order_mail_logs', [
            'order_id' => $order->id,
            'kind' => 'admin:paid',
            'outcome' => 'queued',
            'email' => 'admin@example.org',
        ]);
    }
}