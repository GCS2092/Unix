<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttachOrdersOnLoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_attaches_guest_orders_with_the_same_email(): void
    {
        $user = User::factory()->create(['email' => 'client@mail.test', 'password' => 'motdepasse123']);
        $mine = Order::factory()->create(['user_id' => null, 'guest_email' => 'Client@Mail.test']);
        $other = Order::factory()->create(['user_id' => null, 'guest_email' => 'autre@mail.test']);

        $this->postJson('/api/v1/auth/login', ['email' => 'client@mail.test', 'password' => 'motdepasse123'])
            ->assertOk()
            ->assertJsonPath('attached_orders', 1);

        $this->assertSame($user->id, $mine->fresh()->user_id);
        $this->assertNull($other->fresh()->user_id);
    }

    public function test_failed_login_attaches_nothing(): void
    {
        User::factory()->create(['email' => 'client@mail.test', 'password' => 'motdepasse123']);
        $order = Order::factory()->create(['user_id' => null, 'guest_email' => 'client@mail.test']);

        $this->postJson('/api/v1/auth/login', ['email' => 'client@mail.test', 'password' => 'mauvais'])
            ->assertStatus(422);

        $this->assertNull($order->fresh()->user_id);
    }

    public function test_login_without_guest_orders_reports_zero(): void
    {
        User::factory()->create(['email' => 'client@mail.test', 'password' => 'motdepasse123']);

        $this->postJson('/api/v1/auth/login', ['email' => 'client@mail.test', 'password' => 'motdepasse123'])
            ->assertOk()
            ->assertJsonPath('attached_orders', 0);
    }
}