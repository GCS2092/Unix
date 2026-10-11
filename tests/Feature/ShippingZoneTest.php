<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\ShippingZone;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShippingZoneTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->admin()->create(['admin_scope' => 'super']);
        Sanctum::actingAs($admin);

        return $admin;
    }

    /** @return list<string> */
    private function publicKeys(): array
    {
        return collect($this->getJson('/api/shipping')->assertOk()->json('data.zones'))->pluck('key')->all();
    }

    public function test_regular_user_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/shipping-zones')->assertForbidden();
    }

    public function test_admin_creates_updates_and_deactivates_a_zone(): void
    {
        $this->admin();

        $id = $this->postJson('/api/v1/admin/shipping-zones', [
            'code' => 'thies', 'label_fr' => 'Thiès', 'label_en' => 'Thies', 'fee' => 3500,
        ])->assertCreated()->json('data.id');

        $this->assertContains('thies', $this->publicKeys());

        $this->patchJson("/api/v1/admin/shipping-zones/{$id}", ['fee' => 4000])->assertOk()->assertJsonPath('data.fee', 4000);
        $this->assertSame(4000, (int) ShippingZone::query()->where('code', 'thies')->value('fee'));

        $this->patchJson("/api/v1/admin/shipping-zones/{$id}", ['is_active' => false])->assertOk();
        $this->assertNotContains('thies', $this->publicKeys());
    }

    public function test_code_format_is_validated_and_cannot_be_changed(): void
    {
        $this->admin();

        $this->postJson('/api/v1/admin/shipping-zones', ['code' => 'Bad Code', 'label_fr' => 'X', 'fee' => 0])->assertUnprocessable();

        $zone = ShippingZone::query()->create(['code' => 'louga', 'label_fr' => 'Louga', 'fee' => 1000]);
        $this->patchJson("/api/v1/admin/shipping-zones/{$zone->id}", ['code' => 'autre', 'fee' => 1200])->assertOk();
        $this->assertSame('louga', $zone->fresh()->code);
    }

    public function test_zone_used_by_orders_cannot_be_deleted(): void
    {
        $this->admin();

        $used = ShippingZone::query()->create(['code' => 'kaolack', 'label_fr' => 'Kaolack', 'fee' => 2500]);
        Order::query()->create(['delivery_zone' => 'kaolack']);
        $free = ShippingZone::query()->create(['code' => 'saint_louis', 'label_fr' => 'Saint-Louis', 'fee' => 3000]);

        $this->deleteJson("/api/v1/admin/shipping-zones/{$used->id}")->assertUnprocessable();
        $this->assertDatabaseHas('shipping_zones', ['code' => 'kaolack']);

        $this->deleteJson("/api/v1/admin/shipping-zones/{$free->id}")->assertNoContent();
        $this->assertDatabaseMissing('shipping_zones', ['code' => 'saint_louis']);
    }
}