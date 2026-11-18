<?php

namespace Tests\Feature;

use App\Services\CommunicationSettings;
use App\Services\ShopSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MailSenderNameTest extends TestCase
{
    use RefreshDatabase;

    public function test_sender_follows_shop_name_when_empty(): void
    {
        app(CommunicationSettings::class)->set(['shop_name' => 'ZETA']);
        app(ShopSettings::class)->set(['mail_from_name' => '']);
        app(ShopSettings::class)->apply();

        $this->assertSame('ZETA', config('mail.from.name'));
    }

    public function test_custom_sender_name_wins(): void
    {
        app(CommunicationSettings::class)->set(['shop_name' => 'ZETA']);
        app(ShopSettings::class)->set(['mail_from_name' => 'Equipe ZETA']);
        app(ShopSettings::class)->apply();

        $this->assertSame('Equipe ZETA', config('mail.from.name'));
    }
}