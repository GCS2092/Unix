<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ManualOrderTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->forceFill(['is_admin' => true])->save();
        Sanctum::actingAs($u);

        return $u;
    }

    private function product(int $stock = 5): Product
    {
        return Product::query()->create([
            'name' => 'Routeur', 'slug' => 'routeur-'.uniqid(), 'price' => 10000, 'stock' => $stock, 'is_published' => false,
        ]);
    }

    private function payload(Product $p, int $qty = 2, array $extra = []): array
    {
        return array_merge([
            'guest_name' => 'Awa Diop',
            'phone' => '+221770000000',
            'items' => [['product_id' => $p->id, 'quantity' => $qty]],
            'delivery_method' => 'pickup',
            'source' => 'whatsapp',
            'payment_method' => 'wave',
            'paid' => true,
        ], $extra);
    }

    public function test_manual_paid_order_reserves_stock_and_issues_invoice(): void
    {
        Notification::fake();
        $this->admin();
        $p = $this->product(5);

        $res = $this->postJson('/api/v1/admin/orders/manual', $this->payload($p))->assertCreated();

        $res->assertJsonPath('data.status', 'paid')->assertJsonPath('data.source', 'whatsapp');
        $this->assertSame(3, $p->fresh()->stock);
        $this->assertSame(1, Invoice::query()->count());
    }

    public function test_manual_order_refuses_when_stock_is_insufficient(): void
    {
        $this->admin();
        $p = $this->product(1);

        $this->postJson('/api/v1/admin/orders/manual', $this->payload($p, 3))->assertStatus(422);
        $this->assertSame(1, $p->fresh()->stock);
    }

    public function test_paid_order_requires_payment_method(): void
    {
        $this->admin();
        $p = $this->product();

        $this->postJson('/api/v1/admin/orders/manual', $this->payload($p, 1, ['payment_method' => null]))->assertStatus(422);
    }

    public function test_notes_appear_in_timeline(): void
    {
        Notification::fake();
        $this->admin();
        $p = $this->product();
        $id = $this->postJson('/api/v1/admin/orders/manual', $this->payload($p))->json('data.id');

        $this->postJson("/api/v1/admin/orders/{$id}/notes", ['body' => 'Client rappelé, livraison jeudi'])->assertCreated();

        $types = collect($this->getJson("/api/v1/admin/orders/{$id}/timeline")->assertOk()->json('data'))->pluck('type');
        $this->assertTrue($types->contains('note'));
        $this->assertTrue($types->contains('action'));
    }

    public function test_customers_are_grouped_with_their_spend(): void
    {
        Notification::fake();
        $this->admin();
        $p = $this->product(10);
        $this->postJson('/api/v1/admin/orders/manual', $this->payload($p, 1, ['guest_email' => 'awa@example.com']))->assertCreated();
        $this->postJson('/api/v1/admin/orders/manual', $this->payload($p, 2, ['guest_email' => 'AWA@example.com']))->assertCreated();

        $row = $this->getJson('/api/v1/admin/customers')->assertOk()->json('data.0');

        $this->assertSame('awa@example.com', $row['key']);
        $this->assertSame(2, $row['orders_count']);
        $this->assertSame(30000, $row['spent']);

        $this->getJson('/api/v1/admin/customers/detail?key=awa@example.com')->assertOk()->assertJsonCount(2, 'data.orders');
    }
}