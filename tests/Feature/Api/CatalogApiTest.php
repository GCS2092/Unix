<?php

namespace Tests\Feature\Api;

use App\Models\Course;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_lists_published_courses(): void
    {
        Course::factory()->create(['is_published' => true, 'title' => 'Cours public']);
        Course::factory()->create(['is_published' => false, 'title' => 'Cours brouillon']);

        $response = $this->getJson('/api/v1/catalog/courses');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Cours public');
    }
}
