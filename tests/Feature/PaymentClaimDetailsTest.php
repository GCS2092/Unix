<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentClaimDetailsTest extends TestCase
{
    use RefreshDatabase;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    private function pendingOrder(User $user): Order
    {
        return Order::factory()->create([
            'user_id' => $user->id,
            'status' => OrderStatus::Pending,
            'stock_reserved' => true,
            'reservation_expires_at' => now()->addMinutes(5),
        ]);
    }

    private function png(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('proof.png', base64_decode(self::PNG));
    }

    private function admin(): User
    {
        $admin = User::factory()->admin()->create(['admin_scope' => 'super']);
        Sanctum::actingAs($admin);

        return $admin;
    }

    public function test_method_and_last4_are_validated_and_stored(): void
    {
        config(['payment.manual' => true]);
        $user = User::factory()->create();
        $order = $this->pendingOrder($user);
        Sanctum::actingAs($user);
        $url = "/api/v1/orders/{$order->id}/declare-payment";

        $this->postJson($url, ['method' => 'bitcoin'])->assertStatus(422);
        $this->postJson($url, ['sender_last4' => '12ab'])->assertStatus(422);

        $this->postJson($url, ['reference' => 'W1', 'method' => 'wave', 'sender_last4' => '1234'])
            ->assertOk()
            ->assertJsonPath('data.payment_claimed_method', 'wave');

        $o = $order->fresh();
        $this->assertSame('1234', $o->payment_claimed_last4);
        $this->assertSame('W1', $o->payment_claimed_reference);
    }

    public function test_proof_is_stored_privately_and_only_admin_can_read_it(): void
    {
        Storage::fake('local');
        config(['payment.manual' => true]);
        $user = User::factory()->create();
        $order = $this->pendingOrder($user);
        Sanctum::actingAs($user);

        $this->post("/api/v1/orders/{$order->id}/declare-payment", ['reference' => 'W2', 'proof' => $this->png()], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.payment_proof_sent', true)
            ->assertJsonMissingPath('data.payment_proof_path');

        $path = $order->fresh()->payment_proof_path;
        $this->assertNotNull($path);
        Storage::disk('local')->assertExists($path);

        $this->getJson("/api/v1/admin/payments/{$order->id}/proof")->assertForbidden();

        $this->admin();
        $this->get("/api/v1/admin/payments/{$order->id}/proof")->assertOk();
    }

    public function test_non_image_proof_is_refused(): void
    {
        Storage::fake('local');
        config(['payment.manual' => true]);
        $user = User::factory()->create();
        $order = $this->pendingOrder($user);
        Sanctum::actingAs($user);

        $this->post("/api/v1/orders/{$order->id}/declare-payment", [
            'proof' => UploadedFile::fake()->createWithContent('proof.txt', 'hello'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->assertNull($order->fresh()->payment_proof_path);
    }

    public function test_rejecting_a_claim_clears_details_and_deletes_the_proof(): void
    {
        Storage::fake('local');
        config(['payment.manual' => true]);
        $user = User::factory()->create();
        $order = $this->pendingOrder($user);
        Sanctum::actingAs($user);

        $this->post("/api/v1/orders/{$order->id}/declare-payment", [
            'reference' => 'W3', 'method' => 'wave', 'sender_last4' => '1234', 'proof' => $this->png(),
        ], ['Accept' => 'application/json'])->assertOk();
        $path = $order->fresh()->payment_proof_path;
        $this->assertNotNull($path);

        $this->admin();
        $this->postJson("/api/v1/admin/payments/{$order->id}/reject-claim", ['reason' => 'introuvable'])->assertOk();

        $o = $order->fresh();
        $this->assertNull($o->payment_claimed_method);
        $this->assertNull($o->payment_claimed_last4);
        $this->assertNull($o->payment_proof_path);
        Storage::disk('local')->assertMissing($path);
    }

    public function test_purge_command_deletes_only_old_proofs(): void
    {
        Storage::fake('local');
        $old = Order::factory()->create();
        $new = Order::factory()->create();
        Storage::disk('local')->put('payment-proofs/old.png', 'x');
        Storage::disk('local')->put('payment-proofs/new.png', 'x');
        $old->forceFill(['payment_proof_path' => 'payment-proofs/old.png', 'payment_proof_at' => now()->subDays(100)])->save();
        $new->forceFill(['payment_proof_path' => 'payment-proofs/new.png', 'payment_proof_at' => now()->subDays(5)])->save();

        $this->artisan('payments:purge-proofs')->assertSuccessful();

        Storage::disk('local')->assertMissing('payment-proofs/old.png');
        Storage::disk('local')->assertExists('payment-proofs/new.png');
        $this->assertNull($old->fresh()->payment_proof_path);
        $this->assertNotNull($new->fresh()->payment_proof_path);
    }
}