<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OverviewController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $range = (string) $request->query('range', '30d');
        if (! in_array($range, ['7d', '30d', '90d', '12m', 'all'], true)) {
            $range = '30d';
        }
        $from = match ($range) {
            '7d' => now()->subDays(7),
            '30d' => now()->subDays(30),
            '90d' => now()->subDays(90),
            '12m' => now()->subMonths(12),
            default => null,
        };

        $orders = fn () => DB::table('orders')->when($from, fn ($q) => $q->where('created_at', '>=', $from));

        // Période précédente de même durée, pour afficher les variations
        $previous = null;
        if ($from) {
            $prevFrom = match ($range) {
                '7d' => $from->copy()->subDays(7),
                '30d' => $from->copy()->subDays(30),
                '90d' => $from->copy()->subDays(90),
                default => $from->copy()->subMonths(12),
            };
            $prev = fn () => DB::table('orders')->where('created_at', '>=', $prevFrom)->where('created_at', '<', $from);
            $previous = [
                'orders' => (int) $prev()->count(),
                'paid' => (int) $prev()->where('status', 'paid')->count(),
                'revenue' => (int) $prev()->where('status', 'paid')->sum('total'),
            ];
        }

        $status = $this->grouped($orders(), "COALESCE(status, 'none')");
        $types = array_unique([Product::class, (new Product)->getMorphClass()]);

        // Chiffre d'affaires par produit (commandes payées)
        $lines = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.itemable_id')
            ->where('orders.status', 'paid')
            ->whereIn('order_items.itemable_type', $types)
            ->when($from, fn ($q) => $q->where('orders.created_at', '>=', $from))
            ->groupBy('products.id', 'products.name')
            ->selectRaw('products.name as name, SUM(order_items.line_total) as revenue')
            ->orderByDesc('revenue')
            ->get();
        $top = $lines->take(5)->map(fn ($l) => ['name' => $l->name, 'revenue' => (int) $l->revenue])->values();
        $others = (int) $lines->skip(5)->sum('revenue');

        // Stock et catalogue : état actuel
        $threshold = (int) config('shop.low_stock_threshold', 5);
        $p = DB::table('products')->selectRaw(
            'SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_n,
            SUM(CASE WHEN stock > 0 AND stock <= ? THEN 1 ELSE 0 END) as low_n,
            SUM(CASE WHEN stock > ? THEN 1 ELSE 0 END) as ok_n,
            SUM(CASE WHEN is_published THEN 1 ELSE 0 END) as shown_n,
            SUM(CASE WHEN is_published THEN 0 ELSE 1 END) as hidden_n,
            COALESCE(SUM(stock), 0) as units',
            [$threshold, $threshold],
        )->first();

        $reserved = (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.stock_reserved', true)
            ->where('orders.status', 'pending')
            ->whereIn('order_items.itemable_type', $types)
            ->sum('order_items.quantity');

        $invoices = DB::table('invoices')
            ->when($from, fn ($q) => $q->where('issued_at', '>=', $from));
        $inv = $this->grouped($invoices, 'status');

        $u = DB::table('users')->selectRaw(
            'COUNT(*) as total, SUM(CASE WHEN is_blocked THEN 1 ELSE 0 END) as blocked',
        )->first();

        return response()->json(['data' => [
            'range' => $range,
            'generated_at' => now()->toIso8601String(),
            'previous' => $previous,
            'orders' => [
                'total' => (int) $orders()->count(),
                'status' => $status,
                'delivery_method' => $this->grouped($orders(), "COALESCE(delivery_method, 'none')"),
                'delivery_zone' => $this->grouped($orders()->where('delivery_method', 'delivery'), "COALESCE(delivery_zone, 'none')"),
                'fulfillment' => $this->grouped($orders()->where('status', 'paid'), "COALESCE(fulfillment_status, 'none')"),
                'paid_with_conflict' => (int) $orders()->where('status', 'paid')->where('stock_conflict', true)->count(),
                'accounts' => (int) $orders()->whereNotNull('user_id')->count(),
                'guests' => (int) $orders()->whereNull('user_id')->count(),
            ],
            'revenue' => [
                'total' => (int) $orders()->where('status', 'paid')->sum('total'),
                'by_product' => $top,
                'others' => $others,
            ],
            'stock' => [
                'threshold' => $threshold,
                'out' => (int) ($p->out_n ?? 0),
                'low' => (int) ($p->low_n ?? 0),
                'ok' => (int) ($p->ok_n ?? 0),
                'published' => (int) ($p->shown_n ?? 0),
                'hidden' => (int) ($p->hidden_n ?? 0),
                'units_available' => (int) ($p->units ?? 0),
                'units_reserved' => $reserved,
            ],
            'invoices' => ['issued' => (int) ($inv['issued'] ?? 0), 'cancelled' => (int) ($inv['cancelled'] ?? 0)],
            'users' => [
                'total' => (int) ($u->total ?? 0),
                'blocked' => (int) ($u->blocked ?? 0),
            ],
        ]]);
    }

    /** @return array<string, int> */
    private function grouped($query, string $expr): array
    {
        return $query
            ->selectRaw("$expr as k, COUNT(*) as n")
            ->groupBy(DB::raw($expr))
            ->pluck('n', 'k')
            ->map(fn ($n) => (int) $n)
            ->all();
    }
}