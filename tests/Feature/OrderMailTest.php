<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Notifications\GuestAccessNotification;
use App\Notifications\OrderPaidNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderMailTest extends TestCase
{
    use RefreshDatabase;

    public function test_paid_mail_follows_the_order_language(): void
    {
        $user = User::factory()->create();
        $en = Order::factory()->create(['user_id' => $user->id, 'locale' => 'en']);
        $fr = Order::factory()->create(['user_id' => $user->id, 'locale' => 'fr']);

        $nEn = new OrderPaidNotification($en);
        $nFr = new OrderPaidNotification($fr);
        $this->assertSame('en', $nEn->locale);
        $this->assertSame('fr', $nFr->locale);

        app()->setLocale('en');
        $this->assertStringContainsString('confirmed', $nEn->toMail($user)->subject);
        app()->setLocale('fr');
        $this->assertStringContainsString('Confirmation', $nFr->toMail($user)->subject);
    }

    public function test_guest_access_mail_links_to_the_frontend(): void
    {
        $user = User::factory()->create();
        $n = new GuestAccessNotification('tok123', 'a@b.test', 'en');

        app()->setLocale('en');
        $mail = $n->toMail($user);
        $this->assertSame('Your access to UNIX', $mail->subject);
        $this->assertStringContainsString('mot-de-passe/reinitialiser?token=tok123', $mail->actionUrl);
    }
}