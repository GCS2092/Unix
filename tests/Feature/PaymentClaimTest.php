<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentClaimTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_declare_payment_and_reservation_is_extended(): void
    {
        config(['payment.manual' => true]);
        $user = User::factory()->create();
        $order = Order::factory()->create([
            'user_id' => $user->id,
            'status' => OrderStatus::Pending,
            'stock_reserved' => true,
            'reservation_expires_at' => now()->addMinutes(5),
        ]);
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/orders/{$order->id}/declare-payment", ['reference' => 'W123'])
            ->assertOk()
            ->assertJsonPath('data.payment_claimed_reference', 'W123');

        $o = $order->fresh();
        $this->assertNotNull($o->payment_claimed_at);
        $this->assertTrue($o->reservation_expires_at->gt(now()->addHours(2)));
        $this->assertSame(OrderStatus::Pending, $o->status);
    }

    public function test_other_user_cannot_declare(): void
    {
        config(['payment.manual' => true]);
        $order = Order::factory()->create(['status' => OrderStatus::Pending]);
        Sanctum::actingAs(User::factory()->create());

        $this->postJson("/api/v1/orders/{$order->id}/declare-payment")->assertForbidden();
    }

    public function test_guest_can_declare_with_tracking_token(): void
    {
        config(['payment.manual' => true]);
        $order = Order::factory()->create(['user_id' => null, 'guest_email' => 'a@b.test', 'status' => OrderStatus::Pending]);
        $token = $order->ensureTrackingToken();

        $this->postJson("/api/v1/track/{$token}/declare-payment", ['reference' => 'OM9'])->assertOk();
        $this->assertSame('OM9', $order->fresh()->payment_claimed_reference);
    }

    public function test_refused_when_manual_mode_is_off(): void
    {
        config(['payment.manual' => false]);
        $user = User::factory()->create();
        $order = Order::factory()->create(['user_id' => $user->id, 'status' => OrderStatus::Pending]);
        Sanctum::actingAs($user);

        $this->postJson("/api/v1/orders/{$order->id}/declare-payment")->assertStatus(422);
    }
}