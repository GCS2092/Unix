<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminFormationsTest extends TestCase
{
    use RefreshDatabase;

    private function actAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
    }

    private function makeCourse(): Course
    {
        return Course::query()->create([
            'title' => 'Cours test',
            'slug' => 'cours-test-'.uniqid(),
            'price' => 0,
            'is_published' => true,
        ]);
    }

    public function test_non_admin_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->student()->create());

        $this->getJson('/api/v1/admin/formations/dashboard')->assertForbidden();
    }

    public function test_dashboard_counts_enrollments(): void
    {
        $this->actAsAdmin();
        $student = User::factory()->student()->create();
        $course = $this->makeCourse();
        Enrollment::query()->create(['user_id' => $student->id, 'course_id' => $course->id, 'progress' => 0]);

        $this->getJson('/api/v1/admin/formations/dashboard')
            ->assertOk()
            ->assertJsonPath('data.summary.enrollments_total', 1)
            ->assertJsonPath('data.summary.in_progress', 1)
            ->assertJsonPath('data.summary.students_without_course', 0);
    }

    public function test_new_email_creates_a_student_account(): void
    {
        Notification::fake();
        $this->actAsAdmin();

        $this->postJson('/api/v1/admin/formations/students', [
            'email' => 'nouveau@example.com',
            'name' => 'Awa Diop',
        ])->assertCreated()->assertJsonPath('created', true);

        $this->assertTrue((bool) User::query()->where('email', 'nouveau@example.com')->first()->is_student);
    }

    public function test_existing_email_is_linked_not_duplicated(): void
    {
        $this->actAsAdmin();
        $client = User::factory()->create(['email' => 'client@example.com']);

        $this->postJson('/api/v1/admin/formations/students', ['email' => 'CLIENT@example.com'])
            ->assertOk()
            ->assertJsonPath('created', false);

        $this->assertTrue((bool) $client->fresh()->is_student);
        $this->assertSame(1, User::query()->where('email', 'client@example.com')->count());
    }

    public function test_enroll_rejects_duplicates_and_enables_student(): void
    {
        $this->actAsAdmin();
        $client = User::factory()->create();
        $course = $this->makeCourse();
        $payload = ['user_id' => $client->id, 'course_id' => $course->id];

        $this->postJson('/api/v1/admin/formations/enroll', $payload)->assertCreated();
        $this->postJson('/api/v1/admin/formations/enroll', $payload)->assertStatus(422);

        $this->assertTrue((bool) $client->fresh()->is_student);
    }
}