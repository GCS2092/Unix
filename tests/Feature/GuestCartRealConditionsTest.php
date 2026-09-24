<?php

namespace Tests\Feature;

use App\Enums\CartItemType;
use App\Models\Course;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestCartRealConditionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cart_persists_across_requests_with_real_middleware(): void
    {
        $course = Course::factory()->create(['price' => 10000, 'is_published' => true]);

        $this->postJson('/api/v1/cart/items', [
            'type' => CartItemType::Course->value,
            'id' => $course->id,
        ])->assertOk();

        $this->getJson('/api/v1/cart')
            ->assertOk()
            ->assertJsonPath('data.items.0.quantity', 1);
    }

    public function test_unpublished_course_cannot_be_added_to_cart(): void
    {
        $course = Course::factory()->create(['is_published' => false]);

        $response = $this->postJson('/api/v1/cart/items', [
            'type' => CartItemType::Course->value,
            'id' => $course->id,
        ]);

        $this->assertContains($response->getStatusCode(), [404, 422]);
    }

    public function test_checkout_with_empty_cart_is_rejected(): void
    {
        $this->postJson('/api/v1/checkout', ['guest_email' => 'vide@example.com'])
            ->assertStatus(422);
    }
}
