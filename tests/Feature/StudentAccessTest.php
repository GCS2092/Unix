<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_cannot_use_course_routes(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));

        $this->getJson('/api/v1/enrollments')->assertForbidden();
        $this->postJson('/api/v1/livekit/token', ['course_id' => 1])->assertForbidden();
    }

    public function test_student_can_list_enrollments(): void
    {
        Sanctum::actingAs(User::factory()->student()->create());

        $this->getJson('/api/v1/enrollments')->assertOk();
    }

    public function test_customer_still_reaches_shop_account_routes(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/orders')->assertOk();
    }
}