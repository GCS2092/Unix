<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Notifications\OrderPaymentExpiredNotification;
use App\Services\CommunicationSettings;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class GuestInvoiceAndExpiryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        app()->setLocale('fr');
    }

    private function expiredOrder(): Order
    {
        return Order::factory()->create([
            'user_id' => null,
            'guest_email' => 'a@b.test',
            'locale' => 'fr',
            'status' => OrderStatus::Pending,
            'stock_reserved' => true,
            'reservation_expires_at' => now()->subMinutes(5),
        ]);
    }

    public function test_guest_invoice_refuses_unknown_token_and_unpaid_order(): void
    {
        $this->get('/api/v1/track/'.str_repeat('a', 40).'/invoice')->assertNotFound();

        $pending = Order::factory()->create(['status' => OrderStatus::Pending, 'user_id' => null, 'guest_email' => 'a@b.test']);
        $this->get('/api/v1/track/'.$pending->ensureTrackingToken().'/invoice')->assertStatus(422);
    }

    public function test_guest_can_download_the_invoice_of_a_paid_order(): void
    {
        $order = Order::factory()->create(['status' => OrderStatus::Paid, 'paid_at' => now(), 'user_id' => null, 'guest_email' => 'a@b.test']);

        $response = $this->get('/api/v1/track/'.$order->ensureTrackingToken().'/invoice')->assertOk();

        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_expiry_sends_one_email_with_the_retry_link(): void
    {
        Notification::fake();
        $order = $this->expiredOrder();

        app(OrderFulfillmentService::class)->releaseExpired();
        app(OrderFulfillmentService::class)->releaseExpired();

        $this->assertSame(OrderStatus::Failed, $order->fresh()->status);
        Notification::assertSentOnDemandTimes(OrderPaymentExpiredNotification::class, 1);
    }

    public function test_expiry_email_respects_the_admin_toggle(): void
    {
        Notification::fake();
        app(CommunicationSettings::class)->set(['send_stage_emails' => false]);
        $this->expiredOrder();

        app(OrderFulfillmentService::class)->releaseExpired();

        Notification::assertNothingSent();
    }

    public function test_expiry_mail_has_reference_and_public_link(): void
    {
        $order = $this->expiredOrder();
        $mail = (new OrderPaymentExpiredNotification($order))->toMail(new AnonymousNotifiable);

        $this->assertStringContainsString($order->public_ref, $mail->subject);
        $this->assertStringContainsString('/suivi/', (string) $mail->actionUrl);
    }

    public function test_expiry_translations_have_the_same_keys(): void
    {
        $fr = require lang_path('fr/expired.php');
        $en = require lang_path('en/expired.php');

        $this->assertSame(array_keys($fr), array_keys($en));
    }
}