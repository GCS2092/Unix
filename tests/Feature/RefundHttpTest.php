<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\CreditNote;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RefundHttpTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    private function actingAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true, 'admin_scope' => 'super']), ['*']);
    }

    private function paidOrder(): Order
    {
        $product = Product::query()->create([
            'name' => 'Produit http', 'slug' => 'ph-'.uniqid(), 'price' => 1000, 'stock' => 5, 'is_published' => true,
        ]);
        $order = Order::query()->create([
            'guest_email' => 'client@example.com', 'guest_name' => 'Awa Diop',
            'status' => OrderStatus::Pending, 'total' => 1000, 'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.uniqid(),
        ]);
        $order->items()->create([
            'itemable_type' => Product::class, 'itemable_id' => $product->id,
            'quantity' => 1, 'unit_price' => 1000, 'line_total' => 1000,
        ]);
        app(OrderFulfillmentService::class)->markPaid($order);

        return $order->fresh();
    }

    private function url(Order $o): string
    {
        return '/api/v1/admin/payments/'.$o->id.'/refund';
    }

    public function test_regular_user_is_forbidden(): void
    {
        $order = $this->paidOrder();
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->postJson($this->url($order), ['reason' => 'Retour produit'])->assertForbidden();
        $this->assertSame(0, CreditNote::query()->count());
    }

    public function test_partial_refund_issues_a_credit_note_and_keeps_the_order_refundable(): void
    {
        $order = $this->paidOrder();
        $this->actingAdmin();

        $res = $this->postJson($this->url($order), ['reason' => 'Geste commercial', 'amount' => 400])->assertOk();

        $res->assertJsonPath('meta.fully_refunded', false);
        $res->assertJsonPath('data.refunded_amount', 400);
        $this->assertNotEmpty($res->json('meta.credit_note'));
        $this->assertNull($order->fresh()->getAttribute('refunded_at'));
        $this->assertSame(1, CreditNote::query()->count());
    }

    public function test_amount_above_the_remaining_balance_is_refused(): void
    {
        $order = $this->paidOrder();
        $this->actingAdmin();

        $this->postJson($this->url($order), ['reason' => 'Trop eleve', 'amount' => 1500])->assertStatus(422);
        $this->assertSame(0, CreditNote::query()->count());
    }

    public function test_full_refund_marks_the_order_and_a_second_one_is_refused(): void
    {
        $order = $this->paidOrder();
        $this->actingAdmin();

        $this->postJson($this->url($order), ['reason' => 'Retour produit'])
            ->assertOk()
            ->assertJsonPath('meta.fully_refunded', true);
        $this->assertNotNull($order->fresh()->getAttribute('refunded_at'));

        $this->postJson($this->url($order), ['reason' => 'Encore'])->assertStatus(422);
        $this->assertSame(1, CreditNote::query()->count());
        $this->assertSame(1000, (int) CreditNote::query()->sum('total'));
    }

    public function test_order_without_invoice_cannot_be_refunded(): void
    {
        $order = Order::factory()->create(['status' => OrderStatus::Paid, 'paid_at' => now(), 'user_id' => null, 'guest_email' => 'a@b.test']);
        $this->actingAdmin();

        $this->postJson($this->url($order), ['reason' => 'Sans facture'])->assertStatus(422);
        $this->assertSame(0, Invoice::query()->count());
        $this->assertSame(0, CreditNote::query()->count());
    }
}