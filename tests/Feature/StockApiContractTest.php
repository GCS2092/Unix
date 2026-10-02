<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockApiContractTest extends TestCase
{
    use RefreshDatabase;

    private function product(int $stock): Product
    {
        return Product::factory()->create(['stock' => $stock, 'is_published' => true]);
    }

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function order(User $user, Product $product, int $qty, OrderStatus $status, array $extra = []): Order
    {
        $order = Order::query()->create([
            'user_id' => $user->id,
            'status' => $status,
            'total' => $product->price * $qty,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.Str::uuid()->toString(),
        ]);

        $order->items()->create([
            'itemable_type' => Product::class,
            'itemable_id' => $product->id,
            'quantity' => $qty,
            'unit_price' => $product->price,
            'line_total' => $product->price * $qty,
        ]);

        if ($extra !== []) {
            $order->forceFill($extra)->save();
        }

        return $order;
    }

    public function test_catalog_exposes_stock_fields(): void
    {
        $product = $this->product(3);

        $json = $this->getJson('/api/v1/catalog/products/'.$product->slug)->assertOk()->json();
        $data = $json['data'] ?? $json;

        $this->assertTrue($data['in_stock']);
        $this->assertSame(3, $data['low_stock']);
        $this->assertSame(3, $data['max_quantity']);
        $this->assertArrayNotHasKey('stock', $data);
    }

    public function test_cart_refuses_quantity_above_stock(): void
    {
        $product = $this->product(3);

        $this->postJson('/api/v1/cart/items', ['type' => 'product', 'id' => $product->id, 'quantity' => 5])
            ->assertStatus(422)
            ->assertJsonPath('code', 'insufficient_stock')
            ->assertJsonPath('product.available', 3)
            ->assertJsonPath('product.requested', 5);

        $this->patchJson('/api/v1/cart/items/product/'.$product->id, ['quantity' => 4])
            ->assertStatus(422)
            ->assertJsonPath('code', 'insufficient_stock');

        $this->postJson('/api/v1/cart/items', ['type' => 'product', 'id' => $product->id, 'quantity' => 3])
            ->assertOk()
            ->assertJsonPath('data.has_stock_issue', false)
            ->assertJsonPath('data.items.0.available_quantity', 3);
    }

    public function test_order_exposes_reservation_expiry(): void
    {
        $user = User::factory()->create();
        $product = $this->product(5);
        $order = $this->order($user, $product, 1, OrderStatus::Pending, [
            'stock_reserved' => true,
            'reservation_expires_at' => now()->addMinutes(30),
        ]);

        Sanctum::actingAs($user);

        $res = $this->getJson('/api/v1/orders/'.$order->id)->assertOk();
        $this->assertNotNull($res->json('data.reservation_expires_at'));
    }

    public function test_retry_payment_reserves_stock_again_after_expiry(): void
    {
        $user = User::factory()->create();
        $product = $this->product(5);
        $order = $this->order($user, $product, 2, OrderStatus::Failed);

        Sanctum::actingAs($user);
        $this->postJson("/api/v1/orders/{$order->id}/retry-payment");

        $this->assertSame(3, $product->fresh()->stock);
        $order = $order->fresh();
        $this->assertTrue($order->stock_reserved);
        $this->assertSame(OrderStatus::Pending, $order->status);
        $this->assertNotNull($order->reservation_expires_at);
    }

    public function test_retry_payment_is_refused_when_stock_is_gone(): void
    {
        $user = User::factory()->create();
        $product = $this->product(1);
        $order = $this->order($user, $product, 2, OrderStatus::Failed);

        Sanctum::actingAs($user);
        $this->postJson("/api/v1/orders/{$order->id}/retry-payment")
            ->assertStatus(422)
            ->assertJsonPath('code', 'insufficient_stock')
            ->assertJsonPath('product.available', 1);

        $this->assertSame(1, $product->fresh()->stock);
        $this->assertSame(OrderStatus::Failed, $order->fresh()->status);
    }

    public function test_admin_filters_low_and_out_of_stock_products(): void
    {
        $this->product(2);
        $this->product(20);
        $this->product(0);

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/v1/admin/products?stock=low')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.low_stock_count', 1)
            ->assertJsonPath('meta.out_of_stock_count', 1);

        $this->getJson('/api/v1/admin/products?stock=out')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_admin_lists_and_resolves_stock_conflicts(): void
    {
        $user = User::factory()->create();
        $product = $this->product(0);

        $conflict = $this->order($user, $product, 2, OrderStatus::Paid, [
            'stock_conflict' => true,
            'stock_reserved' => false,
            'paid_at' => now(),
        ]);
        $this->order($user, $product, 1, OrderStatus::Paid, ['stock_reserved' => true, 'paid_at' => now()]);

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/v1/admin/orders?quick=stock_conflict')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.counts.stock_conflict', 1);

        $this->postJson("/api/v1/admin/orders/{$conflict->id}/resolve-stock-conflict")
            ->assertStatus(422)
            ->assertJsonPath('code', 'insufficient_stock');

        $product->update(['stock' => 5]);

        $this->postJson("/api/v1/admin/orders/{$conflict->id}/resolve-stock-conflict")
            ->assertOk()
            ->assertJsonPath('data.stock_conflict', false);

        $this->assertSame(3, $product->fresh()->stock);
    }
}
