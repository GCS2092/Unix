<?php

namespace Tests\Feature;

use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductLocalizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_follows_the_requested_language(): void
    {
        Product::factory()->create([
            'name' => 'Chaussure',
            'name_en' => 'Shoe',
            'description' => 'Belle chaussure',
            'description_en' => 'Nice shoe',
            'is_published' => true,
        ]);

        $this->getJson('/api/v1/catalog/products', ['Accept-Language' => 'en'])
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Shoe')
            ->assertJsonPath('data.0.description', 'Nice shoe');

        $this->getJson('/api/v1/catalog/products', ['Accept-Language' => 'fr'])
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Chaussure');
    }

    public function test_english_falls_back_to_french_when_not_translated(): void
    {
        Product::factory()->create([
            'name' => 'Sac',
            'name_en' => null,
            'is_published' => true,
        ]);

        $this->getJson('/api/v1/catalog/products', ['Accept-Language' => 'en'])
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Sac');
    }
}