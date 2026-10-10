<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function guestOrder(string $email = 'client@mail.test'): Order
    {
        return Order::factory()->create(['user_id' => null, 'guest_email' => $email]);
    }

    public function test_lookup_needs_reference_and_matching_email(): void
    {
        $order = $this->guestOrder();

        $this->postJson('/api/v1/track/lookup', ['ref' => strtolower($order->public_ref), 'email' => 'CLIENT@mail.test'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['token']]);

        $this->postJson('/api/v1/track/lookup', ['ref' => $order->public_ref, 'email' => 'autre@mail.test'])->assertNotFound();
        $this->postJson('/api/v1/track/lookup', ['ref' => $order->public_ref])->assertStatus(422);
        $this->postJson('/api/v1/track/lookup', ['ref' => 'CMD-ZZZZ-ZZZZ', 'email' => 'client@mail.test'])->assertNotFound();
    }

    public function test_lookup_is_locked_after_five_failures_on_the_same_reference(): void
    {
        $order = $this->guestOrder();

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/track/lookup', ['ref' => $order->public_ref, 'email' => "x$i@mail.test"])->assertNotFound();
        }

        $this->postJson('/api/v1/track/lookup', ['ref' => $order->public_ref, 'email' => 'client@mail.test'])->assertStatus(429);
    }

    public function test_tracking_pages_are_private(): void
    {
        $token = $this->guestOrder()->ensureTrackingToken();

        $response = $this->getJson("/api/v1/track/$token")->assertOk();

        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertSame('noindex, nofollow', $response->headers->get('X-Robots-Tag'));
        $this->assertSame('no-referrer', $response->headers->get('Referrer-Policy'));
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'inconnu@mail.test'])->assertOk();
    }

    public function test_register_does_not_attach_orders_and_sends_a_verification_mail(): void
    {
        Notification::fake();
        $order = $this->guestOrder('new@mail.test');

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Nouveau',
            'email' => 'new@mail.test',
            'password' => 'Motdepasse123!',
            'password_confirmation' => 'Motdepasse123!',
        ])->assertCreated()
            ->assertJsonPath('attached_orders', 0)
            ->assertJsonPath('email_verified', false);

        $this->assertNull($order->fresh()->user_id);
        Notification::assertSentTo(User::query()->where('email', 'new@mail.test')->first(), VerifyEmailNotification::class);
    }

    public function test_unverified_login_does_not_attach_orders(): void
    {
        User::factory()->create(['email' => 'client@mail.test', 'password' => 'motdepasse123', 'email_verified_at' => null]);
        $order = $this->guestOrder();

        $this->postJson('/api/v1/auth/login', ['email' => 'client@mail.test', 'password' => 'motdepasse123'])
            ->assertOk()
            ->assertJsonPath('attached_orders', 0)
            ->assertJsonPath('email_verified', false);

        $this->assertNull($order->fresh()->user_id);
    }

    public function test_verification_link_confirms_the_email_and_attaches_orders(): void
    {
        $user = User::factory()->create(['email' => 'client@mail.test', 'email_verified_at' => null]);
        $order = $this->guestOrder('Client@Mail.test');

        $this->get(VerifyEmailNotification::urlFor($user))->assertRedirect();

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertSame($user->id, $order->fresh()->user_id);
    }

    public function test_tampered_or_wrong_verification_links_are_refused(): void
    {
        $user = User::factory()->create(['email' => 'client@mail.test', 'email_verified_at' => null]);

        $this->get(VerifyEmailNotification::urlFor($user).'&x=1')->assertForbidden();

        $wrongHash = URL::temporarySignedRoute('api.v1.auth.verify-email', now()->addHour(), ['id' => $user->id, 'hash' => 'deadbeef']);
        $this->get($wrongHash)->assertForbidden();

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_password_reset_confirms_the_email(): void
    {
        $user = User::factory()->create(['email' => 'client@mail.test', 'email_verified_at' => null]);
        $token = \Illuminate\Support\Facades\Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'client@mail.test',
            'password' => 'NouveauMotdepasse1!',
            'password_confirmation' => 'NouveauMotdepasse1!',
        ])->assertOk();

        $this->assertNotNull($user->fresh()->email_verified_at);
    }

    public function test_resend_verification_needs_login_and_is_sent_once_requested(): void
    {
        $this->postJson('/api/v1/auth/email/resend')->assertUnauthorized();

        Notification::fake();
        $user = User::factory()->create(['email_verified_at' => null]);
        Sanctum::actingAs($user, ['*']);

        $this->postJson('/api/v1/auth/email/resend')->assertOk();
        Notification::assertSentTo($user, VerifyEmailNotification::class);
    }
}