<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentPortalTest extends TestCase
{
    use RefreshDatabase;

    public function test_student_sees_live_flag_without_room_name(): void
    {
        $student = User::factory()->student()->create();
        $course = Course::query()->create([
            'title' => 'Cours live',
            'slug' => 'cours-live-'.uniqid(),
            'price' => 0,
            'is_published' => true,
            'livekit_room' => 'salle-secrete',
        ]);
        Enrollment::query()->create(['user_id' => $student->id, 'course_id' => $course->id, 'progress' => 0]);

        Sanctum::actingAs($student);

        $this->getJson('/api/v1/enrollments')
            ->assertOk()
            ->assertJsonPath('data.0.course.has_live', true)
            ->assertJsonMissingPath('data.0.course.livekit_room');
    }
}