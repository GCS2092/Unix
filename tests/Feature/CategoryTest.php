<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CategoryTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create(['admin_scope' => 'super']));
    }

    public function test_regular_user_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->getJson('/api/v1/admin/categories')->assertForbidden();
    }

    public function test_slug_is_unique_and_stable_on_rename(): void
    {
        $this->admin();

        $a = $this->postJson('/api/v1/admin/categories', ['name' => 'Ordinateurs'])->assertCreated();
        $b = $this->postJson('/api/v1/admin/categories', ['name' => 'Ordinateurs'])->assertCreated();
        $this->assertSame('ordinateurs', $a->json('data.slug'));
        $this->assertSame('ordinateurs-2', $b->json('data.slug'));

        $this->patchJson('/api/v1/admin/categories/'.$a->json('data.id'), ['name' => 'PC portables'])
            ->assertOk()->assertJsonPath('data.slug', 'ordinateurs');
    }

    public function test_catalog_filters_by_category_and_lists_only_useful_ones(): void
    {
        $pc = Category::query()->create(['name' => 'Ordinateurs', 'slug' => 'ordinateurs']);
        Category::query()->create(['name' => 'Vide', 'slug' => 'vide']);
        Product::factory()->create(['is_published' => true, 'category_id' => $pc->id]);
        Product::factory()->create(['is_published' => true, 'category_id' => null]);

        $this->assertCount(2, $this->getJson('/api/v1/catalog/products')->assertOk()->json('data'));
        $this->assertCount(1, $this->getJson('/api/v1/catalog/products?category=ordinateurs')->assertOk()->json('data'));

        $cats = $this->getJson('/api/v1/catalog/categories')->assertOk()->json('data');
        $this->assertSame(['ordinateurs'], collect($cats)->pluck('slug')->all());
        $this->assertSame(1, $cats[0]['products_count']);
    }

    public function test_deleting_a_category_keeps_its_products(): void
    {
        $this->admin();

        $cat = Category::query()->create(['name' => 'Accessoires', 'slug' => 'accessoires']);
        $product = Product::factory()->create(['is_published' => true, 'category_id' => $cat->id]);

        $this->deleteJson("/api/v1/admin/categories/{$cat->id}")->assertNoContent();
        $this->assertNull($product->fresh()->category_id);
    }

    public function test_admin_product_list_filters_by_category(): void
    {
        $this->admin();

        $cat = Category::query()->create(['name' => 'Ordinateurs', 'slug' => 'ordinateurs']);
        Product::factory()->create(['category_id' => $cat->id]);
        Product::factory()->count(2)->create(['category_id' => null]);

        $this->assertCount(1, $this->getJson("/api/v1/admin/products?category={$cat->id}")->assertOk()->json('data'));
        $this->assertCount(2, $this->getJson('/api/v1/admin/products?category=none')->assertOk()->json('data'));
    }
}