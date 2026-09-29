<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminProductImageTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['is_admin' => true]);
    }

    public function test_admin_can_upload_an_image(): void
    {
        Storage::fake('public');
        $product = Product::factory()->create();

        $this->actingAs($this->admin())
            ->post("/api/v1/admin/products/{$product->getRouteKey()}/image", [
                'image' => UploadedFile::fake()->image('photo.jpg', 600, 600),
            ], ['Accept' => 'application/json'])
            ->assertOk();

        $path = $product->fresh()->image_path;
        $this->assertNotNull($path);
        Storage::disk('public')->assertExists($path);
        $this->assertNotNull($product->fresh()->imageUrl());
    }

    public function test_admin_can_use_a_link_and_it_replaces_the_uploaded_file(): void
    {
        Storage::fake('public');
        $product = Product::factory()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->post("/api/v1/admin/products/{$product->getRouteKey()}/image", [
            'image' => UploadedFile::fake()->image('photo.jpg'),
        ], ['Accept' => 'application/json'])->assertOk();
        $old = $product->fresh()->image_path;

        $this->actingAs($admin)
            ->putJson("/api/v1/admin/products/{$product->getRouteKey()}", ['image_link' => 'https://example.com/a.jpg'])
            ->assertOk()
            ->assertJsonPath('data.image_url', 'https://example.com/a.jpg');

        Storage::disk('public')->assertMissing($old);
        $this->assertNull($product->fresh()->image_path);
    }

    public function test_admin_can_remove_the_image(): void
    {
        Storage::fake('public');
        $product = Product::factory()->create(['image_link' => 'https://example.com/a.jpg']);

        $this->actingAs($this->admin())
            ->deleteJson("/api/v1/admin/products/{$product->getRouteKey()}/image")
            ->assertOk()
            ->assertJsonPath('data.image_url', null);
    }

    public function test_upload_rejects_non_images_and_bad_links(): void
    {
        Storage::fake('public');
        $product = Product::factory()->create();
        $admin = $this->admin();

        $this->actingAs($admin)->post("/api/v1/admin/products/{$product->getRouteKey()}/image", [
            'image' => UploadedFile::fake()->create('virus.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        $this->actingAs($admin)
            ->putJson("/api/v1/admin/products/{$product->getRouteKey()}", ['image_link' => 'javascript:alert(1)'])
            ->assertStatus(422);
    }
}