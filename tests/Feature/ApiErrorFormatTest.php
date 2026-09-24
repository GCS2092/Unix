<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiErrorFormatTest extends TestCase
{
    use RefreshDatabase;

    public function test_validation_errors_return_422_with_field_details(): void
    {
        $this->postJson('/api/v1/auth/register', [])
            ->assertStatus(422)
            ->assertJsonStructure(['message', 'errors']);
    }

    public function test_unknown_route_returns_json_404(): void
    {
        $this->getJson('/api/v1/route-inexistante')->assertStatus(404);
    }
}
