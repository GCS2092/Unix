<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class CertificateTemplateSlotsTest extends TestCase
{
    public function test_all_four_slots_are_routable_and_others_are_not(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_ends_with($r->uri(), 'certificate-template/{slot}'));

        $this->assertGreaterThanOrEqual(2, $routes->count());

        foreach ($routes as $route) {
            $constraint = (string) ($route->wheres['slot'] ?? '');
            foreach (['logo', 'signature', 'signature2', 'stamp'] as $slot) {
                $this->assertMatchesRegularExpression('/^(?:'.$constraint.')$/', $slot, "slot $slot refuse");
            }
            $this->assertDoesNotMatchRegularExpression('/^(?:'.$constraint.')$/', 'autre', 'slot inconnu accepte');
        }
    }
}