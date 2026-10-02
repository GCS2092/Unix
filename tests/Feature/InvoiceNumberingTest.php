<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class InvoiceNumberingTest extends TestCase
{
    use RefreshDatabase;

    private OrderFulfillmentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->service = app(OrderFulfillmentService::class);
    }

    private function pendingOrder(?Product $product = null): Order
    {
        $product ??= Product::query()->create([
            'name' => 'Produit facture', 'slug' => 'pf-'.uniqid(), 'price' => 1000, 'stock' => 5, 'is_published' => true,
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

        return $order;
    }

    public function test_numbers_are_sequential_without_gaps(): void
    {
        $year = now()->format('Y');
        $this->service->markPaid($this->pendingOrder());
        $this->service->markPaid($this->pendingOrder());

        $this->assertSame(
            ["FAC-{$year}-000001", "FAC-{$year}-000002"],
            Invoice::query()->orderBy('id')->pluck('number')->all(),
        );
    }

    public function test_replayed_payment_creates_a_single_invoice(): void
    {
        $order = $this->pendingOrder();
        $this->service->markPaid($order);
        $this->service->markPaid($order);

        $this->assertSame(1, Invoice::query()->count());
    }

    public function test_invoice_is_a_frozen_copy(): void
    {
        $product = Product::query()->create([
            'name' => 'Nom initial', 'slug' => 'ni-'.uniqid(), 'price' => 1000, 'stock' => 5, 'is_published' => true,
        ]);
        $order = $this->pendingOrder($product);
        $this->service->markPaid($order);

        $product->update(['name' => 'Nom modifié']);

        $invoice = Invoice::query()->firstOrFail();
        $this->assertSame('Nom initial', $invoice->items[0]['name']);
        $this->assertSame('Awa Diop', $invoice->customer_name);
        $this->assertSame(1000, $invoice->total);
    }

    public function test_cancelling_the_order_keeps_the_number_and_marks_it_cancelled(): void
    {
        $order = $this->pendingOrder();
        $this->service->markPaid($order);
        $number = Invoice::query()->firstOrFail()->number;

        $this->service->cancel($order);

        $invoice = Invoice::query()->firstOrFail();
        $this->assertSame($number, $invoice->number);
        $this->assertSame('cancelled', $invoice->status);
    }
}