<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use App\Services\CommunicationSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommunicationSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function actingAdmin(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]), ['*']);
    }

    private function text(MailMessage $mail): string
    {
        return implode("\n", array_map('strval', array_merge($mail->introLines, $mail->outroLines)));
    }

    private function guestMail(array $orderState = []): array
    {
        $order = Order::factory()->create(array_merge([
            'user_id' => null,
            'guest_email' => 'a@b.test',
            'locale' => 'fr',
            'delivery_method' => 'pickup',
        ], $orderState));
        app()->setLocale('fr');

        return [$order, (new OrderPaidNotification($order))->toMail(new AnonymousNotifiable)];
    }

    public function test_regular_user_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->getJson('/api/v1/admin/settings/communications')->assertForbidden();
        $this->putJson('/api/v1/admin/settings/communications', ['prep_days' => 2])->assertForbidden();
    }

    public function test_defaults_are_returned_when_nothing_is_stored(): void
    {
        $this->actingAdmin();

        $this->getJson('/api/v1/admin/settings/communications')
            ->assertOk()
            ->assertJsonPath('data.shop_name', 'UNIX')
            ->assertJsonPath('data.attach_invoice', true)
            ->assertJsonPath('data.prep_days', 0);
    }

    public function test_admin_can_update_partially(): void
    {
        $this->actingAdmin();

        $this->putJson('/api/v1/admin/settings/communications', [
            'support_whatsapp' => '+221 77 123 45 67',
            'prep_days' => 3,
            'attach_invoice' => false,
        ])->assertOk();

        $this->getJson('/api/v1/admin/settings/communications')
            ->assertOk()
            ->assertJsonPath('data.prep_days', 3)
            ->assertJsonPath('data.attach_invoice', false)
            ->assertJsonPath('data.support_whatsapp', '+221 77 123 45 67')
            ->assertJsonPath('data.shop_name', 'UNIX');
    }

    public function test_invalid_values_are_rejected(): void
    {
        $this->actingAdmin();

        $this->putJson('/api/v1/admin/settings/communications', ['prep_days' => 999])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings/communications', ['support_email' => 'nope'])->assertStatus(422);
        $this->putJson('/api/v1/admin/settings/communications', ['support_whatsapp' => 'abc'])->assertStatus(422);
    }

    public function test_public_view_exposes_only_safe_fields(): void
    {
        $this->getJson('/api/v1/public/communications')
            ->assertOk()
            ->assertJsonPath('data.shop_name', 'UNIX')
            ->assertJsonMissingPath('data.pickup_place')
            ->assertJsonMissingPath('data.attach_invoice');
    }

    public function test_guest_confirmation_mail_has_reference_and_tracking_help(): void
    {
        [$order, $mail] = $this->guestMail();
        $text = $this->text($mail);

        $this->assertStringContainsString($order->public_ref, $mail->subject);
        $this->assertStringContainsString($order->public_ref, $text);
        $this->assertStringContainsString('/suivi/', $text);
        $this->assertStringContainsString('ne le partagez pas', $text);
        $this->assertStringContainsString('Astuce', $text);
    }

    public function test_admin_settings_show_up_in_the_mail(): void
    {
        app(CommunicationSettings::class)->set([
            'message_fr' => 'Ferme le dimanche',
            'pickup_place' => 'Boutique Plateau',
            'pickup_hours' => 'Lun-Sam 9h-18h',
            'prep_days' => 2,
            'support_whatsapp' => '+221 77 000 00 00',
        ]);

        [, $mail] = $this->guestMail();
        $text = $this->text($mail);

        $this->assertStringContainsString('Ferme le dimanche', $text);
        $this->assertStringContainsString('Boutique Plateau', $text);
        $this->assertStringContainsString('Lun-Sam 9h-18h', $text);
        $this->assertStringContainsString('2 jour(s)', $text);
        $this->assertStringContainsString('+221 77 000 00 00', $text);
    }

    public function test_empty_settings_hide_their_blocks_and_toggles_work(): void
    {
        app(CommunicationSettings::class)->set(['invite_account_cta' => false, 'attach_invoice' => false]);

        [, $mail] = $this->guestMail();
        $text = $this->text($mail);

        $this->assertStringNotContainsString('Lieu de retrait', $text);
        $this->assertStringNotContainsString('Astuce', $text);
        $this->assertStringNotContainsString('jointe', $text);
        $this->assertCount(0, $mail->rawAttachments);
    }

    public function test_confirmation_keys_exist_in_both_languages(): void
    {
        $fr = require lang_path('fr/mail.php');
        $en = require lang_path('en/mail.php');

        $this->assertSame(array_keys($fr['paid']), array_keys($en['paid']));
        $this->assertSame(array_keys($fr['confirm']), array_keys($en['confirm']));
    }
}