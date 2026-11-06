<?php

namespace Tests\Feature;

use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\User;
use App\Notifications\AdminOrderAlertNotification;
use App\Notifications\OrderReceptionReminderNotification;
use App\Notifications\OrderStatusNotification;
use App\Services\AdminAlerts;
use App\Services\CommunicationSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OrderNotificationsTest extends TestCase
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

    public function test_notify_customer_sends_to_guest_email(): void
    {
        Notification::fake();
        $order = $this->makeOrder(['guest_email' => 'client@example.org']);

        $sent = $order->notifyCustomer(new OrderStatusNotification($order, 'shipped'));

        $this->assertSame('client@example.org', $sent);
        Notification::assertSentOnDemand(OrderStatusNotification::class);
    }

    public function test_notify_customer_without_email_sends_nothing(): void
    {
        Notification::fake();
        $order = $this->makeOrder();

        $this->assertNull($order->notifyCustomer(new OrderStatusNotification($order, 'shipped')));
        Notification::assertNothingSent();
    }

    public function test_steps_depend_on_delivery_method(): void
    {
        $this->assertSame(
            ['received', 'preparing', 'shipped', 'delivered'],
            array_map(fn ($s) => $s->value, FulfillmentStatus::stepsFor('delivery')),
        );
        $this->assertSame(
            ['received', 'preparing', 'ready', 'delivered'],
            array_map(fn ($s) => $s->value, FulfillmentStatus::stepsFor('pickup')),
        );
        $this->assertSame([], FulfillmentStatus::stepsFor(null));
    }

    public function test_backfill_sets_received_only_with_apply(): void
    {
        $order = $this->makeOrder(['delivery_method' => 'delivery']);

        $this->artisan('orders:backfill-received')->assertSuccessful();
        $this->assertNull($order->fresh()->fulfillment_status);

        $this->artisan('orders:backfill-received', ['--apply' => true])->assertSuccessful();
        $this->assertSame(FulfillmentStatus::Received, $order->fresh()->fulfillment_status);
    }

    public function test_reminders_skip_pickup_already_collected(): void
    {
        Notification::fake();

        $shipped = $this->makeOrder(['guest_email' => 'a@example.org', 'delivery_method' => 'delivery', 'fulfillment_status' => FulfillmentStatus::Shipped]);
        $collected = $this->makeOrder(['guest_email' => 'b@example.org', 'delivery_method' => 'pickup', 'fulfillment_status' => FulfillmentStatus::Delivered]);

        foreach ([[$shipped, 'shipped'], [$collected, 'delivered']] as [$order, $step]) {
            $event = OrderEvent::query()->create(['order_id' => $order->id, 'step' => $step]);
            $event->forceFill(['created_at' => now()->subDays(10)])->save();
        }

        $this->artisan('orders:remind-reception')->assertSuccessful();

        Notification::assertSentOnDemandTimes(OrderReceptionReminderNotification::class, 1);
    }

    public function test_admin_alert_goes_to_admins_and_can_be_disabled(): void
    {
        Notification::fake();
        User::factory()->create(['is_admin' => true, 'email' => 'admin@example.org']);
        $order = $this->makeOrder(['guest_email' => 'client@example.org']);

        app(AdminAlerts::class)->orderPaid($order);
        Notification::assertSentOnDemandTimes(AdminOrderAlertNotification::class, 1);

        app(CommunicationSettings::class)->set(['send_admin_alerts' => false]);
        app(AdminAlerts::class)->orderPaid($order);
        Notification::assertSentOnDemandTimes(AdminOrderAlertNotification::class, 1);
    }
}