<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserCoursesTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_only_sees_own_enrollments(): void
    {
        $me = User::factory()->create(['is_admin' => false]);
        $other = User::factory()->create(['is_admin' => false]);
        $mine = Course::factory()->create();
        $theirs = Course::factory()->create();
        Enrollment::factory()->create(['user_id' => $me->id, 'course_id' => $mine->id, 'progress' => 0]);
        Enrollment::factory()->create(['user_id' => $other->id, 'course_id' => $theirs->id, 'progress' => 0]);

        Sanctum::actingAs($me);

        $this->getJson('/api/v1/enrollments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.course.id', $mine->id);
    }

    public function test_not_enrolled_user_cannot_stream_a_course(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));
        $course = Course::factory()->create();

        $this->getJson('/api/v1/courses/'.$course->slug.'/playback')->assertForbidden();
    }
}