<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_link_points_to_the_frontend(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'a@b.test']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'a@b.test'])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class, function ($n) use ($user) {
            $url = call_user_func(ResetPassword::$createUrlCallback, $user, $n->token);

            return str_contains($url, '/mot-de-passe/reinitialiser?token='.$n->token)
                && str_contains($url, 'email=');
        });
    }

    public function test_user_can_reset_password_with_a_valid_token(): void
    {
        $user = User::factory()->create(['email' => 'a@b.test']);
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token,
            'email' => 'a@b.test',
            'password' => 'nouveau-mdp-123',
            'password_confirmation' => 'nouveau-mdp-123',
        ])->assertOk();

        $this->assertTrue(Hash::check('nouveau-mdp-123', $user->fresh()->password));
    }

    public function test_reset_with_an_invalid_token_is_rejected(): void
    {
        User::factory()->create(['email' => 'a@b.test']);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'mauvais-token',
            'email' => 'a@b.test',
            'password' => 'nouveau-mdp-123',
            'password_confirmation' => 'nouveau-mdp-123',
        ])->assertStatus(422);
    }
}