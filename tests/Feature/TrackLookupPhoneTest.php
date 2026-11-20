<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class TrackLookupPhoneTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function orderWithoutEmail(): Order
    {
        return Order::query()->create([
            'status' => OrderStatus::Pending, 'total' => 5000, 'currency' => 'XOF',
            'phone' => '+221771234567', 'guest_name' => 'Client sans mail',
            'payment_transaction_id' => 'ORD-'.uniqid(),
        ])->fresh();
    }

    public function test_order_without_email_is_found_with_reference_and_phone(): void
    {
        $order = $this->orderWithoutEmail();
        $this->assertNotEmpty($order->public_ref);

        $res = $this->postJson('/api/v1/track/lookup', ['ref' => $order->public_ref, 'email' => '77 123 45 67'])->assertOk();

        $this->assertSame($order->fresh()->tracking_token, $res->json('data.token'));
    }

    public function test_wrong_phone_gives_the_same_404(): void
    {
        $order = $this->orderWithoutEmail();

        $this->postJson('/api/v1/track/lookup', ['ref' => $order->public_ref, 'email' => '77 999 99 99'])->assertNotFound();
    }
}