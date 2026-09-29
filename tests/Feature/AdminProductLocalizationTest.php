<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminProductLocalizationTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    public function test_admin_can_store_english_fields(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/api/v1/admin/products', [
                'name' => 'Chaussure',
                'name_en' => 'Shoe',
                'description' => 'Belle chaussure',
                'description_en' => 'Nice shoe',
                'price' => 5000,
            ])
            ->assertCreated()
            ->assertJsonPath('data.name_en', 'Shoe');

        $this->assertDatabaseHas('products', ['name' => 'Chaussure', 'name_en' => 'Shoe']);
    }

    public function test_admin_can_update_english_fields_and_sees_raw_values(): void
    {
        $product = Product::factory()->create(['name' => 'Sac', 'name_en' => null]);

        $this->actingAs($this->admin())
            ->putJson("/api/v1/admin/products/{$product->getRouteKey()}", ['name_en' => 'Bag'])
            ->assertOk();

        $this->assertSame('Bag', $product->fresh()->name_en);

        // L'admin voit toujours les valeurs brutes, même avec Accept-Language: en
        $this->getJson("/api/v1/admin/products/{$product->getRouteKey()}", ['Accept-Language' => 'en'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Sac')
            ->assertJsonPath('data.name_en', 'Bag');
    }
}