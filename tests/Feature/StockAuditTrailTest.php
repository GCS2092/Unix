<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockAuditTrailTest extends TestCase
{
    use RefreshDatabase;

    private function product(int $stock): Product
    {
        return Product::query()->create([
            'name' => 'Produit audit',
            'slug' => 'audit-'.uniqid(),
            'price' => 1000,
            'stock' => $stock,
            'is_published' => true,
        ]);
    }

    private function orderWith(Product $product, OrderStatus $status): Order
    {
        $order = Order::query()->create([
            'guest_email' => 'client@example.com',
            'guest_name' => 'Client',
            'status' => $status,
            'total' => 1000,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.uniqid(),
        ]);
        $order->items()->create([
            'itemable_type' => Product::class,
            'itemable_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 1000,
            'line_total' => 1000,
        ]);

        return $order;
    }

    public function test_manual_adjustment_is_written_to_activity_log(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        Sanctum::actingAs($admin);
        $product = $this->product(2);

        $this->postJson("/api/v1/admin/products/{$product->slug}/stock", ['reason' => 'restock', 'quantity' => 3])
            ->assertOk();

        $this->assertSame(5, $product->fresh()->stock);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'stock.restock',
            'user_id' => $admin->id,
            'subject_id' => $product->id,
        ]);
    }

    public function test_conflict_on_late_payment_is_written_to_activity_log(): void
    {
        Notification::fake();
        $order = $this->orderWith($this->product(0), OrderStatus::Failed);

        $paid = app(OrderFulfillmentService::class)->markPaid($order);

        $this->assertTrue($paid->stock_conflict);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'order.stock_conflict_detected',
            'subject_id' => $order->id,
        ]);
    }

    public function test_product_with_orders_cannot_be_deleted(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $product = $this->product(5);
        $this->orderWith($product, OrderStatus::Pending);

        $this->deleteJson("/api/v1/admin/products/{$product->slug}")->assertStatus(422);

        $this->assertDatabaseHas('products', ['id' => $product->id]);
    }

    public function test_product_without_orders_can_be_deleted(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));
        $product = $this->product(5);

        $this->deleteJson("/api/v1/admin/products/{$product->slug}")->assertNoContent();

        $this->assertDatabaseMissing('products', ['id' => $product->id]);
    }
}