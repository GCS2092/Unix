<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $startToday = now()->startOfDay();
        $start30 = now()->subDays(29)->startOfDay();

        $paid = fn () => Order::query()->where('status', 'paid');

        // Ventes des 14 derniers jours (regroupement en PHP : compatible tous SGBD)
        $days = 14;
        $from = now()->subDays($days - 1)->startOfDay();
        $series = [];
        for ($i = 0; $i < $days; $i++) {
            $series[$from->copy()->addDays($i)->toDateString()] = 0;
        }
        $paid()->where('paid_at', '>=', $from)->get(['id', 'paid_at', 'total'])
            ->each(function (Order $o) use (&$series): void {
                $key = $o->paid_at?->toDateString();
                if ($key !== null && array_key_exists($key, $series)) {
                    $series[$key] += (int) $o->total;
                }
            });

        // Top produits vendus (commandes payees uniquement)
        $productMorph = (new Product)->getMorphClass();
        $top = OrderItem::query()
            ->where('itemable_type', $productMorph)
            ->whereHas('order', fn ($q) => $q->where('status', 'paid'))
            ->selectRaw('itemable_id, SUM(quantity) as qty, SUM(line_total) as revenue')
            ->groupBy('itemable_id')
            ->orderByDesc('qty')
            ->limit(5)
            ->get();
        $names = Product::query()->whereIn('id', $top->pluck('itemable_id'))->pluck('name', 'id');

        $recent = Order::query()->with('user')->latest('id')->limit(6)->get()
            ->map(fn (Order $o) => [
                'id' => $o->id,
                'customer' => $o->user?->name ?? $o->guest_name ?? $o->guest_email ?? '—',
                'total' => (int) $o->total,
                'currency' => $o->currency,
                'status' => $o->status->value,
                'created_at' => $o->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => [
            'kpis' => [
                'revenue_total' => (int) $paid()->sum('total'),
                'revenue_today' => (int) $paid()->where('paid_at', '>=', $startToday)->sum('total'),
                'revenue_30d' => (int) $paid()->where('paid_at', '>=', $start30)->sum('total'),
                'orders_today' => Order::query()->where('created_at', '>=', $startToday)->count(),
                'orders_pending' => Order::query()->where('status', 'pending')->count(),
                'orders_failed' => Order::query()->where('status', 'failed')->count(),
                'orders_to_process' => $paid()
                    ->whereIn('delivery_method', ['delivery', 'pickup'])
                    ->where('fulfillment_status', 'received')
                    ->count(),
                'products_total' => Product::query()->count(),
                'users_total' => User::query()->count(),
                'courses_total' => Course::query()->count(),
                'enrollments_total' => Enrollment::query()->count(),
            ],
            'sales' => collect($series)->map(fn ($total, $date) => ['date' => $date, 'total' => $total])->values(),
            'top_products' => $top->map(fn ($r) => [
                'id' => (int) $r->itemable_id,
                'name' => $names[$r->itemable_id] ?? '—',
                'quantity' => (int) $r->qty,
                'revenue' => (int) $r->revenue,
            ])->values(),
            'low_stock' => Product::query()->where('stock', '<=', (int) config('shop.low_stock_threshold', 5))->orderBy('stock')->limit(5)
                ->get(['id', 'name', 'slug', 'stock'])
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'stock' => $p->stock])->values(),
            'recent_orders' => $recent,
        ]]);
    }
}