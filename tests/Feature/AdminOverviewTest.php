<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOverviewTest extends TestCase
{
    use RefreshDatabase;

    private function order(OrderStatus $status, ?Product $product = null): Order
    {
        $order = Order::query()->create([
            'guest_email' => 'c'.uniqid().'@example.com',
            'guest_name' => 'Client',
            'status' => $status,
            'total' => 1000,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.uniqid(),
            'paid_at' => $status === OrderStatus::Paid ? now() : null,
        ]);

        if ($product) {
            $order->items()->create([
                'itemable_type' => Product::class, 'itemable_id' => $product->id,
                'quantity' => 1, 'unit_price' => 1000, 'line_total' => 1000,
            ]);
        }

        return $order;
    }

    private function product(string $name, int $stock): Product
    {
        return Product::query()->create([
            'name' => $name, 'slug' => 's-'.uniqid(), 'price' => 1000, 'stock' => $stock, 'is_published' => true,
        ]);
    }

    public function test_regular_user_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));

        $this->getJson('/api/v1/admin/overview')->assertForbidden();
    }

    public function test_overview_aggregates_orders_revenue_and_stock(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $star = $this->product('Produit star', 0);   // épuisé
        $this->product('Produit bas', 2);            // stock bas (seuil par défaut 5)
        $this->product('Produit ok', 50);            // en stock

        $this->order(OrderStatus::Paid, $star);
        $this->order(OrderStatus::Paid, $star);
        $this->order(OrderStatus::Failed);
        $this->order(OrderStatus::Pending);

        $this->getJson('/api/v1/admin/overview?range=all')
            ->assertOk()
            ->assertJsonPath('data.orders.total', 4)
            ->assertJsonPath('data.orders.status.paid', 2)
            ->assertJsonPath('data.orders.status.failed', 1)
            ->assertJsonPath('data.orders.status.pending', 1)
            ->assertJsonPath('data.orders.guests', 4)
            ->assertJsonPath('data.revenue.total', 2000)
            ->assertJsonPath('data.revenue.by_product.0.name', 'Produit star')
            ->assertJsonPath('data.revenue.by_product.0.revenue', 2000)
            ->assertJsonPath('data.stock.out', 1)
            ->assertJsonPath('data.stock.low', 1)
            ->assertJsonPath('data.stock.ok', 1)
            ->assertJsonPath('data.stock.published', 3);
    }

    public function test_invalid_range_falls_back_to_default(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->getJson('/api/v1/admin/overview?range=nimporte')->assertOk()->assertJsonPath('data.range', '30d');
    }
}