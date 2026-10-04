<?php

namespace Tests\Feature;

use Tests\TestCase;

class PortalTranslationsTest extends TestCase
{
    public function test_portal_messages_exist_in_french_and_english(): void
    {
        foreach (['wrong_password', 'name_required', 'account_blocked', 'account_blocked_first', 'already_enrolled'] as $key) {
            $fr = __('portal.'.$key, [], 'fr');
            $en = __('portal.'.$key, [], 'en');

            $this->assertNotSame('portal.'.$key, $fr);
            $this->assertNotSame('portal.'.$key, $en);
            $this->assertNotSame($fr, $en);
        }
    }
}