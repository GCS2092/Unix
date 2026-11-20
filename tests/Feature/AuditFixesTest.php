<?php

namespace Tests\Feature;

use App\Models\Certificate;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\EnrollmentPayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditFixesTest extends TestCase
{
    use RefreshDatabase;

    private function course(): Course
    {
        return Course::query()->create([
            'title' => 'Cours audit',
            'slug' => 'cours-audit-'.uniqid(),
            'price' => 10000,
            'is_published' => true,
            'duration_seconds' => 3600,
        ]);
    }

    public function test_identical_payment_within_a_minute_is_refused(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
        $student = User::factory()->student()->create();
        $e = Enrollment::query()->create([
            'user_id' => $student->id,
            'course_id' => $this->course()->id,
            'progress' => 0,
            'payment_tracked' => true,
            'agreed_price' => 10000,
        ]);
        $url = "/api/v1/admin/enrollments/{$e->id}/payments";
        $body = ['amount' => 2000, 'method' => 'cash', 'notify' => false];

        $this->postJson($url, $body)->assertCreated();
        $this->postJson($url, $body)->assertStatus(422);
        $this->postJson($url, ['amount' => 3000] + $body)->assertCreated();

        $this->assertSame(2, EnrollmentPayment::query()->where('enrollment_id', $e->id)->count());
    }

    public function test_revoked_certificate_cannot_be_reissued(): void
    {
        $student = User::factory()->student()->create();
        Sanctum::actingAs($student);
        $e = Enrollment::query()->create([
            'user_id' => $student->id,
            'course_id' => $this->course()->id,
            'progress' => 100,
            'completed_at' => now(),
            'payment_tracked' => false,
        ]);
        Certificate::query()->create([
            'enrollment_id' => $e->id,
            'file_path' => 'certificates/test.pdf',
            'code' => 'AUDIT12345',
            'issued_at' => now(),
            'revoked_at' => now(),
        ]);

        $this->postJson("/api/v1/enrollments/{$e->id}/certificate")->assertForbidden();
    }

    public function test_published_course_requires_a_duration(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->postJson('/api/v1/admin/courses', ['title' => 'Sans duree', 'price' => 1000, 'is_published' => true])
            ->assertStatus(422)
            ->assertJsonValidationErrors('duration_seconds');

        $this->postJson('/api/v1/admin/courses', ['title' => 'Avec duree', 'price' => 1000, 'is_published' => true, 'duration_seconds' => 3600])
            ->assertCreated();
    }
}