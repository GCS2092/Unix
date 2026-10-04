<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountApiTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $over = []): array
    {
        return array_merge([
            'label' => 'Maison',
            'recipient_name' => 'Awa Diop',
            'phone' => '770000000',
            'city' => 'Dakar',
            'address' => 'Rue 10',
        ], $over);
    }

    public function test_first_address_becomes_default(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/v1/addresses', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.is_default', true);
    }

    public function test_user_cannot_touch_another_users_address(): void
    {
        $other = User::factory()->create();
        $addr = Address::query()->create(array_merge($this->payload(), ['user_id' => $other->id]));

        Sanctum::actingAs(User::factory()->create());

        $this->patchJson('/api/v1/addresses/'.$addr->id, $this->payload())->assertNotFound();
        $this->deleteJson('/api/v1/addresses/'.$addr->id)->assertNotFound();
    }

    public function test_profile_and_password_update(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/profile', ['name' => 'Nouveau Nom', 'phone' => '771112233'])
            ->assertOk()
            ->assertJsonPath('user.phone', '771112233');

        $this->putJson('/api/v1/profile/password', [
            'current_password' => 'mauvais',
            'password' => 'nouveau-mdp-123',
            'password_confirmation' => 'nouveau-mdp-123',
        ])->assertStatus(422);

        $this->putJson('/api/v1/profile/password', [
            'current_password' => 'password',
            'password' => 'nouveau-mdp-123',
            'password_confirmation' => 'nouveau-mdp-123',
        ])->assertOk();
    }
}