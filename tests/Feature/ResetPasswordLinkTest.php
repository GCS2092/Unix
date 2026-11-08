<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Brand;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ResetPasswordLinkTest extends TestCase
{
    use RefreshDatabase;

    private function url(User $u): string
    {
        return (string) (new ResetPassword('tok'))->toMail($u)->actionUrl;
    }

    public function test_student_without_orders_gets_the_iga_link(): void
    {
        $u = User::factory()->create(['is_student' => true, 'is_admin' => false]);
        $url = $this->url($u);

        $this->assertStringContainsString('/etudiant/mot-de-passe/reinitialiser?', $url);
        $this->assertStringContainsString('token=tok', $url);
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

    public function test_student_with_orders_keeps_the_shop_link(): void
    {
        $u = User::factory()->create(['is_student' => true, 'is_admin' => false]);
        try {
            \App\Models\Order::factory()->create(['user_id' => $u->id]);
        } catch (\Throwable $e) {
            $this->markTestSkipped('Impossible de creer une commande de test : '.$e->getMessage());
        }
        $url = $this->url($u);

        $this->assertFalse($u->fresh()->isFormationOnly());
        $this->assertStringNotContainsString('/etudiant/mot-de-passe', $url);
        $this->assertSame('shop', Brand::consume());
    }

    public function test_admin_is_never_formation_only(): void
    {
        $u = User::factory()->create(['is_student' => true, 'is_admin' => true]);

        $this->assertFalse($u->isFormationOnly());
        $this->assertStringNotContainsString('/etudiant/mot-de-passe', $this->url($u));
        Brand::consume();
    }
}