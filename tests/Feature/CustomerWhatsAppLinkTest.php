<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Notifications\AdminOrderAlertNotification;
use App\Support\OrderWhatsApp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerWhatsAppLinkTest extends TestCase
{
    use RefreshDatabase;

    private function order(array $attrs = []): Order
    {
        return Order::query()->create($attrs + [
            'status' => OrderStatus::Paid, 'paid_at' => now(), 'total' => 10000, 'currency' => 'XOF',
            'phone' => '+221771234567', 'guest_name' => 'Awa Diop',
            'payment_transaction_id' => 'ORD-'.uniqid(),
        ])->fresh();
    }

    private function mailText(Order $o): string
    {
        $mail = (new AdminOrderAlertNotification($o, 'paid'))->toMail(new \stdClass);

        return implode("\n", array_map('strval', $mail->introLines));
    }

    public function test_customer_link_targets_the_customer_with_tracking_url(): void
    {
        $o = $this->order();
        $url = OrderWhatsApp::customerUrl($o);

        $this->assertStringStartsWith('https://wa.me/221771234567?text=', (string) $url);
        $this->assertStringContainsString(rawurlencode('/suivi/'.$o->fresh()->tracking_token), (string) $url);
    }

    public function test_no_customer_link_without_a_usable_phone(): void
    {
        $this->assertNull(OrderWhatsApp::customerUrl($this->order(['phone' => '12'])));
    }

    public function test_alert_mail_offers_the_link_only_when_the_customer_has_no_email(): void
    {
        $this->assertStringContainsString('Prevenir le client', $this->mailText($this->order()));
        $this->assertStringNotContainsString('Prevenir le client', $this->mailText($this->order(['guest_email' => 'a@b.test'])));
    }
}