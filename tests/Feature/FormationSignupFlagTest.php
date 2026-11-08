<?php

namespace Tests\Feature;

use App\Http\Resources\UserResource;
use App\Models\Course;
use App\Models\EnrollmentRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FormationSignupFlagTest extends TestCase
{
    use RefreshDatabase;

    private function flag(User $u): bool
    {
        return (bool) (new UserResource($u))->toArray(request())['formation_signup'];
    }

    public function test_pending_signup_is_flagged(): void
    {
        $u = User::factory()->create(['is_student' => false, 'is_admin' => false]);
        EnrollmentRequest::query()->create(['user_id' => $u->id, 'course_id' => Course::factory()->create()->id, 'status' => 'pending']);

        $this->assertTrue($this->flag($u));
    }

    public function test_shop_customer_and_admin_are_not_flagged(): void
    {
        $this->assertFalse($this->flag(User::factory()->create(['is_student' => false, 'is_admin' => false])));
        $this->assertFalse($this->flag(User::factory()->create(['is_student' => true, 'is_admin' => true])));
    }
}