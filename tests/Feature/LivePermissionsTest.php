<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LivePermissionsTest extends TestCase
{
    use RefreshDatabase;

    private function prep(): array
    {
        config([
            'services.livekit.api_key' => 'testkey',
            'services.livekit.api_secret' => str_repeat('s', 40),
            'services.livekit.url' => 'wss://live.example.test',
        ]);

        $course = Course::factory()->create(['livekit_room' => 'room-perm']);
        $admin = User::factory()->create();
        $admin->forceFill(['is_admin' => true, 'is_student' => true])->save();
        $student = User::factory()->create();
        $student->forceFill(['is_student' => true])->save();

        return [$course, $student, $admin];
    }

    public function test_admin_grants_and_revokes_speaking(): void
    {
        Http::fake();
        [$course, $student, $admin] = $this->prep();
        Sanctum::actingAs($admin);
        $url = "/api/v1/admin/courses/{$course->id}/live/permit";

        $this->postJson($url, ['identity' => 'user-'.$student->id, 'allow' => true])->assertOk();
        Http::assertSent(fn ($r) => str_contains($r->url(), 'UpdateParticipant') && ($r->data()['permission']['canPublish'] ?? null) === true);

        $this->postJson($url, ['identity' => 'user-'.$student->id, 'allow' => false])->assertOk();
        Http::assertSent(fn ($r) => str_contains($r->url(), 'UpdateParticipant') && ($r->data()['permission']['canPublish'] ?? null) === false);
    }

    public function test_student_cannot_grant_speaking(): void
    {
        Http::fake();
        [$course, $student] = $this->prep();
        Sanctum::actingAs($student);

        $this->postJson("/api/v1/admin/courses/{$course->id}/live/permit", ['identity' => 'user-'.$student->id, 'allow' => true])
            ->assertForbidden();
    }

    public function test_identity_must_be_a_user_identity(): void
    {
        Http::fake();
        [$course, , $admin] = $this->prep();
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/courses/{$course->id}/live/permit", ['identity' => 'server', 'allow' => true])
            ->assertStatus(422);
    }

    public function test_admin_can_remove_a_participant(): void
    {
        Http::fake();
        [$course, $student, $admin] = $this->prep();
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/courses/{$course->id}/live/kick", ['identity' => 'user-'.$student->id])->assertOk();
        Http::assertSent(fn ($r) => str_contains($r->url(), 'RemoveParticipant'));
    }

    public function test_livekit_failure_returns_502(): void
    {
        Http::fake(['*' => Http::response('boom', 500)]);
        [$course, $student, $admin] = $this->prep();
        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/admin/courses/{$course->id}/live/permit", ['identity' => 'user-'.$student->id, 'allow' => true])
            ->assertStatus(502);
    }
}