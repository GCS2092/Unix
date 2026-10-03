<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOverviewPdfTest extends TestCase
{
    use RefreshDatabase;

    public function test_regular_user_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => false]));

        $this->get('/api/v1/admin/overview/pdf')->assertForbidden();
    }

    public function test_admin_downloads_a_real_pdf(): void
    {
        Sanctum::actingAs(User::factory()->create(['is_admin' => true]));

        $response = $this->get('/api/v1/admin/overview/pdf?range=all')->assertOk();

        $this->assertStringContainsString('application/pdf', (string) $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));
        $this->assertStringContainsString('apercu-boutique-all-', (string) $response->headers->get('content-disposition'));
    }
}