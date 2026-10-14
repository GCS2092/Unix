<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WatchProgressTest extends TestCase
{
    use RefreshDatabase;

    private function setup_enrollment(array $extra = []): array
    {
        $user = User::factory()->student()->create(['is_admin' => false]);
        $course = Course::factory()->create(['duration_seconds' => 3600]);
        $enrollment = Enrollment::factory()->create(array_merge([
            'user_id' => $user->id, 'course_id' => $course->id, 'progress' => 0, 'watch_seconds' => 0,
        ], $extra));
        Sanctum::actingAs($user);

        return [$user, $course, $enrollment];
    }

    public function test_cannot_jump_to_100_percent(): void
    {
        [, , $e] = $this->setup_enrollment();

        $this->patchJson("/api/v1/enrollments/{$e->id}/progress", ['progress' => 100])->assertOk();

        $this->assertLessThanOrEqual(2, $e->fresh()->progress);
        $this->assertNull($e->fresh()->completed_at);
    }

    public function test_complete_is_refused_when_not_watched(): void
    {
        [, , $e] = $this->setup_enrollment();

        $this->postJson("/api/v1/enrollments/{$e->id}/complete")->assertStatus(422);
        $this->assertNull($e->fresh()->completed_at);
    }

    public function test_progress_follows_real_watch_time(): void
    {
        [, $c, $e] = $this->setup_enrollment(['last_heartbeat_at' => now()->subSeconds(20)]);
        $c->update(['duration_seconds' => 100]);

        $this->patchJson("/api/v1/enrollments/{$e->id}/progress", ['progress' => 100])->assertOk();

        $p = $e->fresh()->progress;
        $this->assertGreaterThanOrEqual(20, $p);
        $this->assertLessThanOrEqual(24, $p);
    }
}