<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\StockMovementReason;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    private function orderFor(Product $product, int $qty): Order
    {
        $order = Order::query()->create([
            'user_id' => User::factory()->create()->id,
            'status' => OrderStatus::Pending,
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

        return $order;
    }

    public function test_release_called_twice_with_a_stale_order_restores_stock_only_once(): void
    {
        $product = Product::factory()->create(['stock' => 3, 'is_published' => true]);
        $order = $this->orderFor($product, 2);
        $order->forceFill(['stock_reserved' => true])->save();

        $stale = Order::query()->findOrFail($order->id); // copie qui croit encore que le stock est reserve
        $service = app(StockService::class);

        $this->assertTrue($service->release($order, StockMovementReason::Expire));
        $this->assertFalse($service->release($stale, StockMovementReason::Release));
        $this->assertSame(5, $product->fresh()->stock);
    }

    public function test_reserve_called_twice_decrements_stock_only_once(): void
    {
        $product = Product::factory()->create(['stock' => 5, 'is_published' => true]);
        $order = $this->orderFor($product, 2);
        $service = app(StockService::class);

        $service->reserve($order);
        $service->reserve(Order::query()->findOrFail($order->id));

        $this->assertSame(3, $product->fresh()->stock);
    }

    public function test_dashboard_and_stock_page_count_the_same_low_stock_products(): void
    {
        Product::factory()->create(['stock' => 0, 'is_published' => true]);
        Product::factory()->create(['stock' => 2, 'is_published' => true]);
        Product::factory()->create(['stock' => 20, 'is_published' => true]);

        Sanctum::actingAs($this->admin());

        $dashboard = $this->getJson('/api/v1/admin/dashboard')->assertOk()->json();
        $stockPage = $this->getJson('/api/v1/admin/stock')->assertOk()->json();

        $dashCount = data_get($dashboard, 'snapshot.low_stock_count', data_get($dashboard, 'data.snapshot.low_stock_count'));

        $this->assertSame(1, $dashCount);
        $this->assertSame(1, data_get($stockPage, 'summary.low_count'));
    }

    public function test_import_rounds_stock_down_and_refuses_a_zero_price_on_creation(): void
    {
        Sanctum::actingAs($this->admin());

        $csv = "nom;prix;stock\nAlpha test;1000;2,5\nGratuit test;0;3\n";
        $file = UploadedFile::fake()->createWithContent('produits.csv', $csv);

        $this->postJson('/api/v1/admin/product-import', ['file' => $file])->assertOk();

        $this->assertSame(2, Product::query()->where('name', 'Alpha test')->value('stock'));
        $this->assertFalse(Product::query()->where('name', 'Gratuit test')->exists());
    }
}