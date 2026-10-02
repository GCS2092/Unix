<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\StockMovementReason;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminStockPageTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    public function test_overview_returns_summary_reserved_units_and_filters(): void
    {
        Product::factory()->create(['stock' => 0, 'is_published' => true, 'price' => 1000]);
        $b = Product::factory()->create(['stock' => 3, 'is_published' => true, 'price' => 2000]);
        Product::factory()->create(['stock' => 50, 'is_published' => false, 'price' => 100]);

        $order = Order::query()->create([
            'user_id' => User::factory()->create()->id,
            'status' => OrderStatus::Pending,
            'total' => 4000,
            'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.Str::uuid()->toString(),
        ]);
        $order->items()->create([
            'itemable_type' => Product::class,
            'itemable_id' => $b->id,
            'quantity' => 2,
            'unit_price' => 2000,
            'line_total' => 4000,
        ]);
        $order->forceFill(['stock_reserved' => true])->save();

        Sanctum::actingAs($this->admin());

        $this->getJson('/api/v1/admin/stock')
            ->assertOk()
            ->assertJsonPath('summary.products_total', 3)
            ->assertJsonPath('summary.units', 53)
            ->assertJsonPath('summary.value', 11000)
            ->assertJsonPath('summary.out_count', 1)
            ->assertJsonPath('summary.low_count', 1)
            ->assertJsonPath('summary.published_out', 1)
            ->assertJsonPath('summary.reserved_units', 2);

        $this->getJson('/api/v1/admin/stock?filter=reserved')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.reserved', 2);

        $this->getJson('/api/v1/admin/stock?filter=out')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/stock?filter=unpublished')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/stock?filter=low')->assertOk()->assertJsonPath('data.0.status', 'low');
    }

    public function test_global_journal_filters_by_reason_and_product(): void
    {
        $admin = $this->admin();
        $p = Product::factory()->create(['stock' => 1, 'is_published' => true]);
        app(StockService::class)->adjust($p, 5, StockMovementReason::Restock, $admin, 'Arrivage');

        Sanctum::actingAs($admin);

        $this->getJson('/api/v1/admin/stock/movements')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reason', 'restock')
            ->assertJsonPath('data.0.product.id', $p->id);

        $this->getJson('/api/v1/admin/stock/movements?reason=damage')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/stock/movements?product_id='.$p->id)->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_export_works_and_page_is_admin_only(): void
    {
        Product::factory()->create(['stock' => 2, 'is_published' => true]);

        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/stock')->assertForbidden();

        Sanctum::actingAs($this->admin());
        $this->get('/api/v1/admin/stock/export')->assertOk();
    }
}
