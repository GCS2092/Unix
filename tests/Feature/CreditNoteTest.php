<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\CreditNote;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Services\CommunicationSettings;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class CreditNoteTest extends TestCase
{
    use RefreshDatabase;

    private OrderFulfillmentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->service = app(OrderFulfillmentService::class);
    }

    private function pendingOrder(): Order
    {
        $product = Product::query()->create([
            'name' => 'Produit avoir', 'slug' => 'pa-'.uniqid(), 'price' => 1000, 'stock' => 5, 'is_published' => true,
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

    public function test_cancelling_a_paid_order_issues_a_credit_note(): void
    {
        $order = $this->pendingOrder();
        $this->service->markPaid($order);
        $invoice = Invoice::query()->firstOrFail();

        $this->service->cancel($order, 'Client injoignable');

        $note = CreditNote::query()->firstOrFail();
        $year = now()->format('Y');
        $this->assertSame("AV-{$year}-000001", $note->number);
        $this->assertSame($invoice->id, $note->invoice_id);
        $this->assertSame(1000, (int) $note->total);
        $this->assertSame('Client injoignable', $note->reason);
        $this->assertSame('cancelled', $invoice->fresh()->status);
        $this->assertSame($invoice->number, $invoice->fresh()->number);
    }

    public function test_cancelling_twice_issues_a_single_credit_note(): void
    {
        $order = $this->pendingOrder();
        $this->service->markPaid($order);
        $this->service->cancel($order);
        $this->service->cancel($order);

        $this->assertSame(1, CreditNote::query()->count());
    }

    public function test_cancelling_an_unpaid_order_issues_nothing(): void
    {
        $order = $this->pendingOrder();
        $this->service->cancel($order);

        $this->assertSame(0, CreditNote::query()->count());
        $this->assertSame(0, Invoice::query()->count());
    }

    public function test_credit_note_numbers_are_sequential(): void
    {
        foreach ([1, 2] as $_) {
            $o = $this->pendingOrder();
            $this->service->markPaid($o);
            $this->service->cancel($o);
        }
        $year = now()->format('Y');

        $this->assertSame(["AV-{$year}-000001", "AV-{$year}-000002"], CreditNote::query()->orderBy('id')->pluck('number')->all());
    }

    public function test_issued_invoice_cannot_be_edited_or_deleted(): void
    {
        $this->service->markPaid($this->pendingOrder());
        $invoice = Invoice::query()->firstOrFail();

        try {
            $invoice->update(['total' => 1]);
            $this->fail('La modification aurait du etre refusee.');
        } catch (\LogicException) {
            $this->assertSame(1000, (int) $invoice->fresh()->total);
        }

        $this->expectException(\LogicException::class);
        $invoice->delete();
    }

    public function test_strict_fulfillment_setting_is_off_by_default_and_saved(): void
    {
        $settings = app(CommunicationSettings::class);
        $this->assertFalse($settings->all()['strict_fulfillment']);

        $settings->set(['strict_fulfillment' => true]);
        $this->assertTrue($settings->all()['strict_fulfillment']);
    }
}