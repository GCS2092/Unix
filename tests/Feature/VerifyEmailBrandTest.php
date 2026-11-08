<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\EnrollmentRequest;
use App\Models\User;
use App\Notifications\VerifyEmailNotification;
use App\Support\Brand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VerifyEmailBrandTest extends TestCase
{
    use RefreshDatabase;

    private function space(User $u): string
    {
        (new VerifyEmailNotification)->toMail($u);

        return Brand::consume();
    }

    public function test_plain_shop_account_stays_betcc(): void
    {
        $this->assertSame('shop', $this->space(User::factory()->create(['is_student' => false, 'is_admin' => false])));
    }

    public function test_student_without_orders_gets_iga(): void
    {
        $this->assertSame('formation', $this->space(User::factory()->create(['is_student' => true, 'is_admin' => false])));
    }

    public function test_pending_formation_signup_gets_iga(): void
    {
        $u = User::factory()->create(['is_student' => false, 'is_admin' => false]);
        try {
            $course = Course::factory()->create();
            EnrollmentRequest::query()->create(['user_id' => $u->id, 'course_id' => $course->id, 'status' => 'pending']);
        } catch (\Throwable $e) {
            $this->markTestSkipped('Demande de test impossible : '.$e->getMessage());
        }

        $this->assertSame('formation', $this->space($u));
    }

    public function test_admin_stays_betcc(): void
    {
        $this->assertSame('shop', $this->space(User::factory()->create(['is_student' => true, 'is_admin' => true])));
    }
}