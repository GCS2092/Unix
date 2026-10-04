<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LiveFlowTest extends TestCase
{
    use RefreshDatabase;

    private function person(array $flags): User
    {
        $u = User::factory()->create();
        $u->forceFill($flags)->save();

        return $u;
    }

    private function enroll(User $u, Course $c): void
    {
        Enrollment::query()->create(['user_id' => $u->id, 'course_id' => $c->id, 'progress' => 0]);
    }

    private function setup_live(): array
    {
        config([
            'services.livekit.api_key' => 'testkey',
            'services.livekit.api_secret' => str_repeat('s', 40),
            'services.livekit.url' => 'wss://live.example.test',
        ]);

        $course = Course::factory()->create(['livekit_room' => 'room-test']);
        $student = $this->person(['is_student' => true]);
        $admin = $this->person(['is_admin' => true, 'is_student' => true]);
        $this->enroll($student, $course);
        $this->enroll($admin, $course);

        return [$course, $student, $admin];
    }

    public function test_student_waits_until_live_then_joins_read_only(): void
    {
        [$course, $student, $admin] = $this->setup_live();

        Sanctum::actingAs($student);
        $this->postJson('/api/v1/livekit/token', ['course_id' => $course->id])->assertStatus(409);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/courses/{$course->id}/live/start")->assertOk();

        Sanctum::actingAs($student);
        $this->postJson('/api/v1/livekit/token', ['course_id' => $course->id])
            ->assertOk()
            ->assertJsonPath('data.can_publish', false);

        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/livekit/token', ['course_id' => $course->id])
            ->assertOk()
            ->assertJsonPath('data.can_publish', true);
    }

    public function test_status_only_shows_live_of_enrolled_courses_without_room_name(): void
    {
        [$course, $student, $admin] = $this->setup_live();
        $course->forceFill(['is_live' => true])->save();
        $other = $this->person(['is_student' => true]);

        Sanctum::actingAs($student);
        $res = $this->getJson('/api/v1/live/status')->assertOk();
        $res->assertJsonPath('data.0.course_id', $course->id);
        $this->assertStringNotContainsString('room-test', $res->getContent());

        Sanctum::actingAs($other);
        $this->getJson('/api/v1/live/status')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_stop_ends_the_live_for_students(): void
    {
        Http::fake();
        [$course, $student, $admin] = $this->setup_live();

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/courses/{$course->id}/live/start")->assertOk();
        $this->postJson("/api/v1/admin/courses/{$course->id}/live/stop")->assertOk();
        $this->assertFalse((bool) $course->fresh()->is_live);

        Sanctum::actingAs($student);
        $this->postJson('/api/v1/livekit/token', ['course_id' => $course->id])->assertStatus(409);
    }

    public function test_student_cannot_start_a_live(): void
    {
        [$course, $student] = $this->setup_live();

        Sanctum::actingAs($student);
        $this->postJson("/api/v1/admin/courses/{$course->id}/live/start")->assertForbidden();
    }
}