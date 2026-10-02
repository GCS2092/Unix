<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\StockMovementReason;
use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Services\CartService;
use App\Services\OrderFulfillmentService;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Mockery;
use Tests\TestCase;

class StockReservationTest extends TestCase
{
    use RefreshDatabase;

    private OrderFulfillmentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->service = app(OrderFulfillmentService::class);
    }

    private function product(int $stock): Product
    {
        return Product::query()->create([
            'name' => 'Produit test',
            'slug' => 'produit-'.uniqid(),
            'price' => 1000,
            'stock' => $stock,
            'is_published' => true,
        ]);
    }

    private function checkout(Product $product, int $qty = 1): Order
    {
        $cart = Mockery::mock(CartService::class);
        $cart->shouldReceive('isEmpty')->andReturn(false);
        $cart->shouldReceive('detailedItems')->andReturn(collect([[
            'model' => $product,
            'quantity' => $qty,
            'unit_price' => 1000,
            'line_total' => 1000 * $qty,
        ]]));
        $cart->shouldReceive('clear');

        return $this->service->createOrderFromCart($cart, null, 'client@example.com', 'Client');
    }

    public function test_checkout_reserves_stock_and_records_movement(): void
    {
        $product = $this->product(5);

        $order = $this->checkout($product, 2);

        $this->assertSame(3, $product->fresh()->stock);
        $this->assertTrue($order->stock_reserved);
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $product->id,
            'order_id' => $order->id,
            'quantity_change' => -2,
            'stock_after' => 3,
            'reason' => 'reserve',
        ]);
    }

    public function test_second_order_cannot_take_the_last_item_even_with_stale_model(): void
    {
        $product = $this->product(1);

        $this->checkout($product);
        $this->assertSame(0, $product->fresh()->stock);

        $this->expectException(InsufficientStockException::class);
        $this->checkout($product);
    }

    public function test_failed_reservation_leaves_no_order_behind(): void
    {
        $product = $this->product(1);
        $this->checkout($product);

        try {
            $this->checkout($product);
        } catch (InsufficientStockException) {
        }

        $this->assertSame(1, Order::query()->count());
    }

    public function test_mark_paid_does_not_decrement_again(): void
    {
        $product = $this->product(5);
        $order = $this->checkout($product, 2);

        $paid = $this->service->markPaid($order);
        $this->service->markPaid($order);

        $this->assertSame(OrderStatus::Paid, $paid->status);
        $this->assertSame(3, $product->fresh()->stock);
        $this->assertSame(1, StockMovement::query()->count());
    }

    public function test_cancel_releases_stock_only_once(): void
    {
        $product = $this->product(5);
        $order = $this->checkout($product, 2);

        $this->service->cancel($order);
        $this->service->cancel($order);

        $this->assertSame(5, $product->fresh()->stock);
        $this->assertSame(OrderStatus::Cancelled, $order->fresh()->status);
    }

    public function test_cancel_paid_order_restocks(): void
    {
        $product = $this->product(5);
        $order = $this->checkout($product, 2);
        $this->service->markPaid($order);

        $this->service->cancel($order);

        $this->assertSame(5, $product->fresh()->stock);
    }

    public function test_mark_failed_releases_stock_once(): void
    {
        $product = $this->product(5);
        $order = $this->checkout($product, 2);

        $this->service->markFailed($order);
        $this->service->markFailed($order);

        $this->assertSame(5, $product->fresh()->stock);
    }

    public function test_expired_pending_order_is_released_once(): void
    {
        $product = $this->product(5);
        $order = $this->checkout($product, 2);

        $this->assertSame(0, $this->service->releaseExpired());

        $this->travel(31)->minutes();

        $this->assertSame(1, $this->service->releaseExpired());
        $this->assertSame(0, $this->service->releaseExpired());
        $this->assertSame(5, $product->fresh()->stock);
        $this->assertSame(OrderStatus::Failed, $order->fresh()->status);
    }

    public function test_late_webhook_re_reserves_when_stock_is_available(): void
    {
        $product = $this->product(1);
        $order = $this->checkout($product);
        $this->travel(31)->minutes();
        $this->service->releaseExpired();

        $paid = $this->service->markPaid($order);

        $this->assertSame(OrderStatus::Paid, $paid->status);
        $this->assertFalse($paid->stock_conflict);
        $this->assertTrue($paid->stock_reserved);
        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_late_webhook_flags_conflict_when_stock_is_gone(): void
    {
        $product = $this->product(1);
        $orderA = $this->checkout($product);
        $this->travel(31)->minutes();
        $this->service->releaseExpired();

        $this->checkout($product->fresh());

        $paid = $this->service->markPaid($orderA);

        $this->assertSame(OrderStatus::Paid, $paid->status);
        $this->assertTrue($paid->stock_conflict);
        $this->assertFalse($paid->stock_reserved);
        $this->assertSame(0, $product->fresh()->stock);

        // Annuler cette commande ne doit PAS recréer du stock fantôme.
        $this->service->cancel($orderA);
        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_manual_adjustments_are_recorded(): void
    {
        $product = $this->product(5);
        $stock = app(StockService::class);

        $stock->adjust($product, 10, StockMovementReason::Restock, null, 'Livraison');
        $stock->adjust($product, -2, StockMovementReason::Damage, null, 'Carton abîmé');
        $stock->setTo($product, 11, StockMovementReason::Inventory);

        $this->assertSame(11, $product->fresh()->stock);
        $this->assertSame(
            [10, -2, -2],
            StockMovement::query()->orderBy('id')->pluck('quantity_change')->all(),
        );
        $this->assertSame(11, StockMovement::query()->latest('id')->first()->stock_after);
    }

    public function test_manual_adjustment_cannot_go_below_zero(): void
    {
        $product = $this->product(1);

        $this->expectException(ValidationException::class);
        app(StockService::class)->adjust($product, -5, StockMovementReason::Damage);
    }
}