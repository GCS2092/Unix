<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderStatusNotification;
use App\Services\CommunicationSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class StageMailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        app()->setLocale('fr');
    }

    private function order(array $state = []): Order
    {
        return Order::factory()->create(array_merge([
            'user_id' => null,
            'guest_email' => 'a@b.test',
            'locale' => 'fr',
            'delivery_method' => 'pickup',
            'pickup_note' => null,
        ], $state));
    }

    private function text(MailMessage $mail): string
    {
        return implode("\n", array_map('strval', array_merge($mail->introLines, $mail->outroLines)));
    }

    public function test_stage_subject_uses_the_public_reference(): void
    {
        $order = $this->order(['delivery_method' => 'delivery']);
        $mail = (new OrderStatusNotification($order, 'shipped'))->toMail(new AnonymousNotifiable);

        $this->assertStringContainsString($order->public_ref, $mail->subject);
        $this->assertStringNotContainsString('n°'.$order->id, $mail->subject);
    }

    public function test_pickup_ready_mail_uses_admin_settings(): void
    {
        app(CommunicationSettings::class)->set([
            'pickup_place' => 'Boutique Plateau',
            'pickup_hours' => 'Lun-Sam 9h-18h',
            'pickup_requirements' => 'Piece d\'identite',
        ]);
        $order = $this->order();
        $text = $this->text((new OrderStatusNotification($order, 'ready'))->toMail(new AnonymousNotifiable));

        $this->assertStringContainsString('Boutique Plateau', $text);
        $this->assertStringContainsString('Lun-Sam 9h-18h', $text);
        $this->assertStringContainsString('Piece d\'identite', $text);
        $this->assertStringContainsString($order->public_ref, $text);
    }

    public function test_order_pickup_note_wins_over_default_place(): void
    {
        app(CommunicationSettings::class)->set(['pickup_place' => 'Boutique Plateau']);
        $order = $this->order(['pickup_note' => 'Entrepot Almadies']);
        $text = $this->text((new OrderStatusNotification($order, 'ready'))->toMail(new AnonymousNotifiable));

        $this->assertStringContainsString('Entrepot Almadies', $text);
        $this->assertStringNotContainsString('Boutique Plateau', $text);
    }

    public function test_order_without_account_gets_the_public_link_even_for_an_existing_user(): void
    {
        $user = User::factory()->create(['email' => 'a@b.test']);
        $order = $this->order();
        $mail = (new OrderStatusNotification($order, 'shipped'))->toMail($user);

        $this->assertStringContainsString('/suivi/', (string) $mail->actionUrl);
    }

    public function test_tracking_translations_have_the_same_keys(): void
    {
        $fr = require lang_path('fr/tracking.php');
        $en = require lang_path('en/tracking.php');

        $this->assertSame(array_keys($fr), array_keys($en));
        foreach (['preparing', 'shipped', 'ready', 'delivered', 'picked_up'] as $k) {
            $this->assertSame(array_keys($fr[$k]), array_keys($en[$k]));
        }
    }
}