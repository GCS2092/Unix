<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\CreditNote;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Services\InvoiceIssuer;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RefundCreditNoteTest extends TestCase
{
    use RefreshDatabase;

    private OrderFulfillmentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->service = app(OrderFulfillmentService::class);
    }

    private function paidOrder(): Order
    {
        $product = Product::query()->create([
            'name' => 'Produit remboursement', 'slug' => 'pr-'.uniqid(), 'price' => 1000, 'stock' => 5, 'is_published' => true,
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
        $this->service->markPaid($order);

        return $order;
    }

    public function test_partial_refund_then_cancellation_credit_exactly_the_invoice_total(): void
    {
        $order = $this->paidOrder();
        $invoice = Invoice::query()->firstOrFail();
        $issuer = app(InvoiceIssuer::class);

        $first = $issuer->issueRefundNote($invoice, 400, 'Geste commercial');
        $this->assertSame(400, (int) $first->total);
        $this->assertSame('refund', $first->kind);
        $this->assertSame(600, $issuer->remainingToCredit($invoice));

        $this->service->cancel($order, 'Annulation');

        $notes = CreditNote::query()->orderBy('id')->get();
        $this->assertCount(2, $notes);
        $this->assertSame(600, (int) $notes[1]->total);
        $this->assertSame('cancellation', $notes[1]->kind);
        $this->assertSame(1000, (int) $notes->sum('total'));
        $this->assertSame(0, $issuer->remainingToCredit($invoice));
        $this->assertNotSame($notes[0]->number, $notes[1]->number);
    }

    public function test_full_refund_copies_the_invoice_lines(): void
    {
        $this->paidOrder();
        $invoice = Invoice::query()->firstOrFail();

        $note = app(InvoiceIssuer::class)->issueRefundNote($invoice, 1000, 'Retour produit');

        $this->assertSame(1000, (int) $note->total);
        $this->assertSame($invoice->items[0]['name'], $note->items[0]['name']);
        $this->assertCount(count($invoice->items), $note->items);
    }

    public function test_cancelling_after_a_full_refund_issues_no_second_credit_note(): void
    {
        $order = $this->paidOrder();
        $invoice = Invoice::query()->firstOrFail();
        app(InvoiceIssuer::class)->issueRefundNote($invoice, 1000, 'Retour produit');

        $this->service->cancel($order);

        $this->assertSame(1, CreditNote::query()->count());
        $this->assertSame('cancelled', $invoice->fresh()->status);
    }
}