<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Support\OrderMailLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ToNotifyFilterTest extends TestCase
{
    use RefreshDatabase;

    private function paid(array $a = []): Order
    {
        return Order::query()->create($a + [
            'status' => OrderStatus::Paid, 'paid_at' => now(), 'total' => 1000, 'currency' => 'XOF',
            'phone' => '+221771234567', 'payment_transaction_id' => 'ORD-'.uniqid(),
        ]);
    }

    public function test_filter_lists_paid_orders_not_yet_notified(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true, 'admin_scope' => 'super']), ['*']);
        $noMail = $this->paid(['guest_name' => 'Sans mail']);
        $withMail = $this->paid(['guest_email' => 'a@b.test']);
        $failed = $this->paid(['guest_email' => 'c@d.test']);
        OrderMailLog::record($failed, 'paid', 'failed');
        $done = $this->paid(['guest_name' => 'Prevenu']);
        OrderMailLog::record($done, 'whatsapp', 'whatsapp');

        $res = $this->getJson('/api/v1/admin/orders?quick=to_notify')->assertOk();

        $ids = collect($res->json('data'))->pluck('id')->sort()->values()->all();
        $this->assertSame([$noMail->id, $failed->id], $ids);
        $this->assertSame(2, $res->json('meta.counts.to_notify'));
        $this->assertNotContains($withMail->id, $ids);
    }
}