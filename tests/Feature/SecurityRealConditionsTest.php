<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityRealConditionsTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(User $user, OrderStatus $status = OrderStatus::Pending, string $tx = 'ORD-sec-1'): Order
    {
        return Order::query()->create([
            'user_id' => $user->id,
            'status' => $status,
            'total' => 4000,
            'currency' => 'XOF',
            'payment_transaction_id' => $tx,
        ]);
    }

    public function test_protected_routes_reject_unauthenticated_requests(): void
    {
        $owner = User::factory()->create();
        $order = $this->makeOrder($owner);

        $this->getJson('/api/v1/orders')->assertStatus(401);
        $this->getJson('/api/v1/orders/'.$order->id)->assertStatus(401);
        $this->postJson('/api/v1/orders/'.$order->id.'/retry-payment')->assertStatus(401);
        $this->getJson('/api/v1/enrollments')->assertStatus(401);
        $this->postJson('/api/v1/livekit/token', ['course_id' => 1])->assertStatus(401);
        $this->getJson('/api/v1/admin/orders')->assertStatus(401);
        $this->postJson('/api/v1/admin/orders/'.$order->id.'/mark-paid')->assertStatus(401);
    }

    public function test_regular_user_is_blocked_by_real_admin_middleware(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        $order = $this->makeOrder($user);
        Sanctum::actingAs($user, ['*']);

        $this->getJson('/api/v1/admin/orders')->assertStatus(403);
        $this->postJson('/api/v1/admin/orders/'.$order->id.'/mark-paid')->assertStatus(403);

        $this->assertFalse($order->fresh()->isPaid());
    }

    public function test_user_cannot_view_or_retry_another_users_order(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $order = $this->makeOrder($owner, OrderStatus::Failed);

        Sanctum::actingAs($intruder, ['*']);

        $this->getJson('/api/v1/orders/'.$order->id)->assertStatus(403);
        $this->postJson('/api/v1/orders/'.$order->id.'/retry-payment')->assertStatus(403);
    }

    public function test_paid_order_cannot_be_retried(): void
    {
        $user = User::factory()->create();
        $order = $this->makeOrder($user, OrderStatus::Paid);
        Sanctum::actingAs($user, ['*']);

        $this->postJson('/api/v1/orders/'.$order->id.'/retry-payment')->assertStatus(422);
    }

    public function test_webhook_replayed_twice_processes_order_only_once(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $order = $this->makeOrder($user, OrderStatus::Pending, 'ORD-replay-1');

        Http::fake([
            'api-checkout.cinetpay.com/v2/payment/check' => Http::response([
                'data' => ['status' => 'ACCEPTED', 'amount' => 4000, 'currency' => 'XOF'],
            ], 200),
        ]);

        $this->postJson('/api/cinetpay/notify', ['cpm_trans_id' => 'ORD-replay-1'])->assertOk();
        $this->postJson('/api/cinetpay/notify', ['cpm_trans_id' => 'ORD-replay-1'])->assertOk();

        $this->assertTrue($order->fresh()->isPaid());
        Notification::assertSentToTimes($user, OrderPaidNotification::class, 1);
    }

    public function test_webhook_with_unknown_transaction_never_crashes_or_pays(): void
    {
        Http::fake([
            'api-checkout.cinetpay.com/v2/payment/check' => Http::response([
                'data' => ['status' => 'ACCEPTED', 'amount' => 4000, 'currency' => 'XOF'],
            ], 200),
        ]);

        $response = $this->postJson('/api/cinetpay/notify', ['cpm_trans_id' => 'ORD-inconnu']);

        $this->assertLessThan(500, $response->getStatusCode());
        $this->assertSame(0, Order::query()->where('status', OrderStatus::Paid)->count());
    }

    public function test_webhook_with_refused_status_never_marks_order_paid(): void
    {
        $user = User::factory()->create();
        $order = $this->makeOrder($user, OrderStatus::Pending, 'ORD-refused-1');

        Http::fake([
            'api-checkout.cinetpay.com/v2/payment/check' => Http::response([
                'data' => ['status' => 'REFUSED', 'amount' => 4000, 'currency' => 'XOF'],
            ], 200),
        ]);

        $this->postJson('/api/cinetpay/notify', ['cpm_trans_id' => 'ORD-refused-1']);

        $this->assertFalse($order->fresh()->isPaid());
    }
}
