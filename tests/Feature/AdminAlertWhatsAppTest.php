<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Notifications\AdminOrderAlertNotification;
use App\Services\CommunicationSettings;
use App\Support\OrderWhatsApp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAlertWhatsAppTest extends TestCase
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

    private function mailText(Order $order): string
    {
        $mail = (new AdminOrderAlertNotification($order, 'paid'))->toMail(new \stdClass);

        return implode("\n", array_map('strval', $mail->introLines));
    }

    public function test_whatsapp_number_is_saved_and_returned(): void
    {
        $settings = app(CommunicationSettings::class);
        $settings->set(['admin_alert_whatsapp' => '+221 77 123 45 67']);

        $this->assertSame('+221 77 123 45 67', $settings->all()['admin_alert_whatsapp']);
    }

    public function test_mail_has_no_whatsapp_link_without_number(): void
    {
        $order = $this->makeOrder(['guest_email' => 'client@example.org']);
        app(CommunicationSettings::class)->set(['admin_alert_whatsapp' => '']);

        $text = $this->mailText($order);

        $this->assertStringNotContainsString('wa.me', $text);
        $this->assertStringNotContainsString('Envoyer sur WhatsApp', $text);
    }

    public function test_mail_has_whatsapp_link_with_number(): void
    {
        $order = $this->makeOrder(['guest_email' => 'client@example.org']);
        app(CommunicationSettings::class)->set(['admin_alert_whatsapp' => '+221 77 123 45 67']);

        $text = $this->mailText($order);

        $this->assertStringContainsString('Envoyer sur WhatsApp', $text);
        $this->assertStringContainsString('https://wa.me/221771234567?text=', $text);
    }

    public function test_url_uses_digits_only_and_contains_order_ref(): void
    {
        $order = $this->makeOrder(['guest_email' => 'client@example.org']);

        $url = OrderWhatsApp::url($order, '+221 77-123.45 67');

        $this->assertStringStartsWith('https://wa.me/221771234567?text=', $url);
        $this->assertStringContainsString(rawurlencode(OrderWhatsApp::code($order)), $url);
    }
}