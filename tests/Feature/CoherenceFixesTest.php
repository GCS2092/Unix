<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CoherenceFixesTest extends TestCase
{
    use RefreshDatabase;

    public function test_unknown_product_returns_a_clean_not_found_message(): void
    {
        $response = $this->getJson('/api/v1/catalog/products/introuvable-zzz');

        $response->assertNotFound();
        $message = (string) $response->json('message');
        $this->assertStringNotContainsString('No query results', $message);
        $this->assertStringNotContainsString('App\\Models', $message);
        $this->assertContains($message, [
            trans('api.not_found', [], 'fr'),
            trans('api.not_found', [], 'en'),
        ]);
    }

    public function test_admin_courses_list_honours_per_page(): void
    {
        Course::factory()->count(25)->create();
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $this->getJson('/api/v1/admin/courses?per_page=100')->assertOk()->assertJsonCount(25, 'data');
        $this->getJson('/api/v1/admin/courses')->assertOk()->assertJsonCount(20, 'data');
    }
}