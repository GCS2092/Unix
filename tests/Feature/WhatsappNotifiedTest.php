<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WhatsappNotifiedTest extends TestCase
{
    use RefreshDatabase;

    private function paidOrderWithoutEmail(): Order
    {
        return Order::query()->create([
            'status' => OrderStatus::Paid, 'paid_at' => now(), 'total' => 10000, 'currency' => 'XOF',
            'phone' => '+221771234567', 'guest_name' => 'Client sans mail',
            'payment_transaction_id' => 'ORD-'.uniqid(),
        ]);
    }

    public function test_regular_user_is_forbidden(): void
    {
        $order = $this->paidOrderWithoutEmail();
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->postJson('/api/v1/admin/orders/'.$order->id.'/mark-notified')->assertForbidden();
        $this->assertDatabaseMissing('order_mail_logs', ['order_id' => $order->id]);
    }

    public function test_admin_marks_the_customer_as_notified_on_whatsapp(): void
    {
        $order = $this->paidOrderWithoutEmail();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true, 'admin_scope' => 'super']), ['*']);

        $this->postJson('/api/v1/admin/orders/'.$order->id.'/mark-notified')->assertOk();

        $this->assertDatabaseHas('order_mail_logs', ['order_id' => $order->id, 'kind' => 'whatsapp', 'outcome' => 'whatsapp']);
    }

    public function test_admin_order_exposes_a_tracking_link_and_the_last_notification(): void
    {
        $order = $this->paidOrderWithoutEmail();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true, 'admin_scope' => 'super']), ['*']);
        $this->postJson('/api/v1/admin/orders/'.$order->id.'/mark-notified')->assertOk();

        $res = $this->getJson('/api/v1/admin/orders/'.$order->id)->assertOk();

        $this->assertStringContainsString('/suivi/', (string) $res->json('data.tracking_url'));
        $this->assertSame('whatsapp', $res->json('data.last_mail.outcome'));
    }
}