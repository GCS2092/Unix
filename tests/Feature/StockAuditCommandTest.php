<?php

namespace Tests\Feature;

use App\Enums\StockMovementReason;
use App\Models\Product;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockAuditCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_audit_passes_when_movements_match_stock(): void
    {
        $p = Product::query()->create(['name' => 'A', 'slug' => 'a-'.uniqid(), 'price' => 100, 'stock' => 0, 'is_published' => true]);
        app(StockService::class)->adjust($p, 7, StockMovementReason::Initial);

        $this->artisan('stock:audit')->assertExitCode(0);
    }

    public function test_audit_fails_when_stock_was_changed_outside_the_service(): void
    {
        $p = Product::query()->create(['name' => 'B', 'slug' => 'b-'.uniqid(), 'price' => 100, 'stock' => 0, 'is_published' => true]);
        app(StockService::class)->adjust($p, 7, StockMovementReason::Initial);
        $p->forceFill(['stock' => 99])->save();

        $this->artisan('stock:audit')->assertExitCode(1);
    }
}