<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestRetryTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_or_malformed_token_is_not_found(): void
    {
        $this->postJson('/api/v1/track/'.str_repeat('a', 40).'/retry-payment')->assertNotFound();
        $this->postJson('/api/v1/track/short/retry-payment')->assertNotFound();
    }

    public function test_paid_order_cannot_be_retried_with_a_token(): void
    {
        $order = Order::factory()->create(['status' => OrderStatus::Paid, 'user_id' => null, 'guest_email' => 'a@b.test']);
        $token = $order->ensureTrackingToken();

        $this->postJson("/api/v1/track/$token/retry-payment")->assertStatus(422);
    }

    public function test_cancelled_order_cannot_be_retried_with_a_token(): void
    {
        $order = Order::factory()->create(['status' => OrderStatus::Cancelled, 'user_id' => null, 'guest_email' => 'a@b.test']);
        $token = $order->ensureTrackingToken();

        $this->postJson("/api/v1/track/$token/retry-payment")->assertStatus(422);
    }
}