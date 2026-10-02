<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderFulfillmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceAdminApiTest extends TestCase
{
    use RefreshDatabase;

    private function paidOrder(string $customer): Order
    {
        $product = Product::query()->create([
            'name' => 'Produit', 'slug' => 'p-'.uniqid(), 'price' => 1000, 'stock' => 10, 'is_published' => true,
        ]);
        $order = Order::query()->create([
            'guest_email' => 'c'.uniqid().'@example.com', 'guest_name' => $customer,
            'status' => OrderStatus::Pending, 'total' => 1000, 'currency' => 'XOF',
            'payment_transaction_id' => 'ORD-'.uniqid(),
        ]);
        $order->items()->create([
            'itemable_type' => Product::class, 'itemable_id' => $product->id,
            'quantity' => 1, 'unit_price' => 1000, 'line_total' => 1000,
        ]);
        app(OrderFulfillmentService::class)->markPaid($order);

        return $order;
    }

    private function admin(): User
    {
        $admin = User::factory()->create(['is_admin' => true]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    public function test_regular_user_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));

        $this->getJson('/api/v1/admin/invoices')->assertForbidden();
    }

    public function test_list_filters_and_summary(): void
    {
        $this->admin();
        $this->paidOrder('Awa Diop');
        $cancelled = $this->paidOrder('Moussa Ndiaye');
        app(OrderFulfillmentService::class)->cancel($cancelled);

        $this->getJson('/api/v1/admin/invoices')
            ->assertOk()
            ->assertJsonPath('summary.count', 2)
            ->assertJsonPath('summary.issued_count', 1)
            ->assertJsonPath('summary.cancelled_count', 1)
            ->assertJsonPath('summary.issued_total', 1000);

        $this->getJson('/api/v1/admin/invoices?status=cancelled')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer_name', 'Moussa Ndiaye');

        $this->getJson('/api/v1/admin/invoices?q=awa')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer_name', 'Awa Diop');
    }

    public function test_single_pdf_download(): void
    {
        $this->admin();
        $this->paidOrder('Awa Diop');
        $invoice = Invoice::query()->firstOrFail();

        $res = $this->get("/api/v1/admin/invoices/{$invoice->id}/pdf")->assertOk();

        $this->assertStringStartsWith('%PDF', $res->getContent());
        $this->assertStringContainsString($invoice->number.'_Awa-Diop.pdf', (string) $res->headers->get('Content-Disposition'));
    }

    public function test_zip_contains_named_pdfs_and_journal(): void
    {
        $this->admin();
        $year = now()->format('Y');
        $this->paidOrder('Awa Diop');
        $this->paidOrder('Éléonore N\'Diaye');

        $res = $this->postJson('/api/v1/admin/invoices/zip', ['ids' => Invoice::query()->pluck('id')->all()])->assertOk();

        $zip = new \ZipArchive();
        $this->assertTrue($zip->open($res->baseResponse->getFile()->getPathname()) === true);

        $names = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $names[] = $zip->getNameIndex($i);
        }

        $this->assertContains("FAC-{$year}-000001_Awa-Diop.pdf", $names);
        $this->assertContains("FAC-{$year}-000002_Eleonore-N-Diaye.pdf", $names);
        $this->assertContains('journal-factures.csv', $names);
        $this->assertStringContainsString("FAC-{$year}-000001", (string) $zip->getFromName('journal-factures.csv'));
        $zip->close();
    }

    public function test_zip_without_match_is_rejected(): void
    {
        $this->admin();
        $this->paidOrder('Awa Diop');

        $this->postJson('/api/v1/admin/invoices/zip', ['status' => 'cancelled'])->assertStatus(422);
    }

    public function test_customer_download_uses_the_frozen_invoice_number(): void
    {
        $this->admin();
        $order = $this->paidOrder('Awa Diop');
        $number = Invoice::query()->firstOrFail()->number;

        $res = $this->get("/api/v1/orders/{$order->id}/invoice")->assertOk();

        $this->assertStringContainsString($number.'.pdf', (string) $res->headers->get('Content-Disposition'));
    }
}