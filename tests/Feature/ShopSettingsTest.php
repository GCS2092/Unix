<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShopSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['admin_scope' => 'super']));
    }

    public function test_regular_user_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/settings/shop')->assertForbidden();
        $this->putJson('/api/v1/admin/settings/shop', ['min_order' => 1000])->assertForbidden();
    }

    public function test_saved_values_are_returned_and_applied_to_config(): void
    {
        $this->admin();

        $this->putJson('/api/v1/admin/settings/shop', [
            'legal_name' => 'Unix SARL',
            'ninea' => '0012345',
            'rccm' => 'SN-DKR-2026-B-1234',
            'invoice_footer' => 'Merci de votre confiance',
            'min_order' => 5000,
            'free_shipping_threshold' => 50000,
            'reservation_minutes' => 45,
        ])->assertOk()->assertJsonPath('data.legal_name', 'Unix SARL');

        $this->assertSame('Unix SARL', config('invoice.name'));
        $this->assertSame('SN-DKR-2026-B-1234', config('invoice.rccm'));
        $this->assertSame('Merci de votre confiance', config('invoice.footer'));
        $this->assertSame(45, config('shop.reservation_minutes'));
        $this->assertSame(5000, config('shop.min_order'));

        $this->getJson('/api/v1/admin/settings/shop')->assertOk()->assertJsonPath('data.min_order', 5000);
    }

    public function test_invalid_values_are_rejected(): void
    {
        $this->admin();

        $this->putJson('/api/v1/admin/settings/shop', ['reservation_minutes' => 1])->assertUnprocessable();
        $this->putJson('/api/v1/admin/settings/shop', ['min_order' => -5])->assertUnprocessable();
        $this->putJson('/api/v1/admin/settings/shop', ['social_facebook' => 'pas une url'])->assertUnprocessable();
    }

    public function test_public_endpoints_expose_the_rules(): void
    {
        $this->admin();
        $this->putJson('/api/v1/admin/settings/shop', [
            'min_order' => 3000,
            'free_shipping_threshold' => 20000,
            'opening_hours' => 'Lun-Sam 9h-18h',
        ])->assertOk();

        $this->getJson('/api/shipping')->assertOk()
            ->assertJsonPath('data.min_order', 3000)
            ->assertJsonPath('data.free_shipping_threshold', 20000);

        $this->getJson('/api/v1/public/shop')->assertOk()
            ->assertJsonPath('data.opening_hours', 'Lun-Sam 9h-18h')
            ->assertJsonPath('data.min_order', 3000)
            ->assertJsonStructure(['data' => ['shop_name', 'pickup_place', 'pickup_hours', 'support_email']]);
    }
}