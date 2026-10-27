<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use App\Notifications\OrderReceptionReminderNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReminderAndResendTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function shippedOrder(int $daysAgo, array $state = []): Order
    {
        $order = Order::factory()->create(array_merge([
            'user_id' => null,
            'guest_email' => 'a@b.test',
            'locale' => 'fr',
            'status' => OrderStatus::Paid,
            'delivery_method' => 'delivery',
            'fulfillment_status' => 'shipped',
            'received_confirmed_at' => null,
        ], $state));
        $event = OrderEvent::query()->create(['order_id' => $order->id, 'step' => 'shipped']);
        $event->forceFill(['created_at' => now()->subDays($daysAgo)])->save();

        return $order;
    }

    public function test_reminder_is_sent_once_after_the_delay(): void
    {
        Notification::fake();
        $old = $this->shippedOrder(6);
        $recent = $this->shippedOrder(1);
        $confirmed = $this->shippedOrder(6, ['received_confirmed_at' => now()]);

        $this->artisan('orders:remind-reception')->assertSuccessful();
        $this->artisan('orders:remind-reception')->assertSuccessful();

        Notification::assertSentOnDemandTimes(OrderReceptionReminderNotification::class, 1);
        $this->assertNotNull($old->fresh()->reception_reminded_at);
        $this->assertNull($recent->fresh()->reception_reminded_at);
        $this->assertNull($confirmed->fresh()->reception_reminded_at);
    }

    public function test_reminder_mail_has_reference_and_public_link(): void
    {
        app()->setLocale('fr');
        $order = $this->shippedOrder(6);
        $mail = (new OrderReceptionReminderNotification($order))->toMail(new \Illuminate\Notifications\AnonymousNotifiable);

        $this->assertStringContainsString($order->public_ref, $mail->subject);
        $this->assertStringContainsString('/suivi/', (string) $mail->actionUrl);
    }

    public function test_admin_can_resend_confirmation_only_for_paid_orders(): void
    {
        Notification::fake();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true, 'admin_scope' => 'super']), ['*']);
        $paid = $this->shippedOrder(1);
        $pending = Order::factory()->create(['status' => OrderStatus::Pending, 'user_id' => null, 'guest_email' => 'c@d.test']);

        $this->postJson("/api/v1/admin/orders/{$paid->id}/resend-confirmation")->assertOk();
        Notification::assertSentOnDemand(OrderPaidNotification::class);

        $this->postJson("/api/v1/admin/orders/{$pending->id}/resend-confirmation")->assertStatus(422);
    }

    public function test_regular_user_cannot_resend(): void
    {
        Sanctum::actingAs(User::factory()->create(), ['*']);
        $order = $this->shippedOrder(1);

        $this->postJson("/api/v1/admin/orders/{$order->id}/resend-confirmation")->assertForbidden();
    }
}