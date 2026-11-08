<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\GuestAccessNotification;
use App\Support\Brand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestAccessLinkTest extends TestCase
{
    use RefreshDatabase;

    private function url(User $u): string
    {
        return (string) (new GuestAccessNotification('tok', $u->email))->toMail($u)->actionUrl;
    }

    public function test_student_without_orders_gets_the_iga_link(): void
    {
        $u = User::factory()->create(['is_student' => true, 'is_admin' => false]);
        $url = $this->url($u);

        $this->assertStringContainsString('/etudiant/mot-de-passe/reinitialiser?', $url);
        $this->assertSame('formation', Brand::consume());
    }

    public function test_shop_customer_gets_the_shop_link(): void
    {
        $u = User::factory()->create(['is_student' => false, 'is_admin' => false]);
        $url = $this->url($u);

        $this->assertStringContainsString('/mot-de-passe/reinitialiser?', $url);
        $this->assertStringNotContainsString('/etudiant/', $url);
        $this->assertSame('shop', Brand::consume());
    }
}