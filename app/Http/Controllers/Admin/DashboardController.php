<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private const CACHE_SECONDS = 30;
    private const MAX_DAYS = 366;

    public function __invoke(Request $request): JsonResponse
    {
        $request->validate([
            'range' => ['nullable', 'in:7d,30d,90d,12m,custom'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        [$from, $to] = $this->resolvePeriod($request);

        $key = 'admin.dashboard.v'.Cache::get('admin.dashboard.version', 1).'.'.$from->toDateString().'.'.$to->toDateString();
        $data = Cache::remember($key, self::CACHE_SECONDS, fn () => $this->build($from, $to));

        return response()->json(['data' => $data]);
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function resolvePeriod(Request $request): array
    {
        $range = (string) $request->query('range', '30d');
        $today = now()->endOfDay();

        if ($range === 'custom' && $request->query('from') && $request->query('to')) {
            $from = Carbon::parse((string) $request->query('from'))->startOfDay();
            $to = Carbon::parse((string) $request->query('to'))->endOfDay();

            if ($to->lt($from)) {
                [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
            }
            if ($to->gt($today)) {
                $to = $today;
            }
            if ($from->gt($to)) {
                $from = $to->copy()->startOfDay();
            }
            if ($from->diffInDays($to) > self::MAX_DAYS) {
                $from = $to->copy()->subDays(self::MAX_DAYS)->startOfDay();
            }

            return [$from, $to];
        }

        $from = match ($range) {
            '7d' => now()->subDays(6)->startOfDay(),
            '90d' => now()->subDays(89)->startOfDay(),
            '12m' => now()->subMonths(11)->startOfMonth(),
            default => now()->subDays(29)->startOfDay(),
        };

        return [$from, $today];
    }

    /**
     * @return array<string, mixed>
     */
    private function build(Carbon $from, Carbon $to): array
    {
        $days = (int) $from->diffInDays($to) + 1;
        $granularity = $days > 92 ? 'month' : 'day';

        $prevTo = $from->copy()->subSecond();
        $prevFrom = $from->copy()->subDays($days)->startOfDay();

        $productMorph = (new Product)->getMorphClass();
        $courseMorph = (new Course)->getMorphClass();

        // ---- Indicateurs avec comparaison a la periode precedente ----
        $cur = $this->periodFigures($from, $to);
        $prev = $this->periodFigures($prevFrom, $prevTo);

        $metrics = [
            'revenue' => $this->metric($cur['revenue'], $prev['revenue']),
            'paid_orders' => $this->metric($cur['paid_orders'], $prev['paid_orders']),
            'avg_basket' => $this->metric($cur['avg_basket'], $prev['avg_basket']),
            'orders_created' => $this->metric($cur['orders_created'], $prev['orders_created']),
            'payment_rate' => $this->metric($cur['payment_rate'], $prev['payment_rate']),
            'new_customers' => $this->metric($cur['new_customers'], $prev['new_customers']),
            'new_enrollments' => $this->metric($cur['new_enrollments'], $prev['new_enrollments']),
        ];

        // ---- Courbe CA / commandes (agregat SQL, trous combles) ----
        $expr = $this->bucket('paid_at', $granularity);
        $rows = $this->paidBetween($from, $to)
            ->selectRaw("$expr as bucket, SUM(total) as revenue, COUNT(*) as orders")
            ->groupBy('bucket')
            ->orderBy('bucket')
            ->get()
            ->keyBy('bucket');

        $series = [];
        $cursor = $granularity === 'month' ? $from->copy()->startOfMonth() : $from->copy()->startOfDay();
        while ($cursor->lte($to)) {
            $k = $granularity === 'month' ? $cursor->format('Y-m') : $cursor->toDateString();
            $series[] = [
                'date' => $k,
                'revenue' => (int) ($rows[$k]->revenue ?? 0),
                'orders' => (int) ($rows[$k]->orders ?? 0),
            ];
            $granularity === 'month' ? $cursor->addMonth() : $cursor->addDay();
        }

        // ---- Repartition des commandes creees par statut ----
        $statuses = DB::table('orders')
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('status, COUNT(*) as n')
            ->groupBy('status')
            ->pluck('n', 'status')
            ->map(fn ($n, $status) => ['status' => (string) $status, 'count' => (int) $n])
            ->values();

        // ---- Produits physiques vs cours ----
        $salesByType = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', 'paid')
            ->whereBetween('orders.paid_at', [$from, $to])
            ->selectRaw('order_items.itemable_type as type, SUM(order_items.line_total) as revenue, SUM(order_items.quantity) as qty')
            ->groupBy('order_items.itemable_type')
            ->get()
            ->map(fn ($r) => [
                'type' => match ($r->type) {
                    $productMorph => 'product',
                    $courseMorph => 'course',
                    default => 'other',
                },
                'revenue' => (int) $r->revenue,
                'quantity' => (int) $r->qty,
            ])->values();

        // ---- Modes de livraison et villes ----
        $deliveries = $this->paidBetween($from, $to)
            ->selectRaw('COALESCE(delivery_method, \'none\') as method, COUNT(*) as orders, SUM(total) as revenue')
            ->groupByRaw('COALESCE(delivery_method, \'none\')')
            ->get()
            ->map(fn ($r) => ['method' => (string) $r->method, 'orders' => (int) $r->orders, 'revenue' => (int) $r->revenue])
            ->values();

        $topCities = $this->paidBetween($from, $to)
            ->whereNotNull('city')
            ->where('city', '!=', '')
            ->selectRaw('city, COUNT(*) as orders, SUM(total) as revenue')
            ->groupBy('city')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['city' => (string) $r->city, 'orders' => (int) $r->orders, 'revenue' => (int) $r->revenue])
            ->values();

        // ---- Classements ----
        $topProducts = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.itemable_id')
            ->where('order_items.itemable_type', $productMorph)
            ->where('orders.status', 'paid')
            ->whereBetween('orders.paid_at', [$from, $to])
            ->selectRaw('products.id as id, products.name as name, SUM(order_items.quantity) as qty, SUM(order_items.line_total) as revenue')
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['id' => (int) $r->id, 'name' => (string) $r->name, 'quantity' => (int) $r->qty, 'revenue' => (int) $r->revenue])
            ->values();

        $topCourses = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('courses', 'courses.id', '=', 'order_items.itemable_id')
            ->where('order_items.itemable_type', $courseMorph)
            ->where('orders.status', 'paid')
            ->whereBetween('orders.paid_at', [$from, $to])
            ->selectRaw('courses.id as id, courses.title as title, SUM(order_items.quantity) as qty, SUM(order_items.line_total) as revenue')
            ->groupBy('courses.id', 'courses.title')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($r) => ['id' => (int) $r->id, 'title' => (string) $r->title, 'quantity' => (int) $r->qty, 'revenue' => (int) $r->revenue])
            ->values();

        $topCustomers = DB::table('orders')
            ->leftJoin('users', 'users.id', '=', 'orders.user_id')
            ->where('orders.status', 'paid')
            ->whereBetween('orders.paid_at', [$from, $to])
            ->selectRaw('COALESCE(users.email, orders.guest_email) as email, MAX(COALESCE(users.name, orders.guest_name)) as name, COUNT(*) as orders, SUM(orders.total) as revenue')
            ->groupByRaw('COALESCE(users.email, orders.guest_email)')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'name' => (string) ($r->name ?? $r->email ?? '—'),
                'email' => $r->email,
                'orders' => (int) $r->orders,
                'revenue' => (int) $r->revenue,
            ])->values();

        // ---- A traiter / a relancer (independants de la periode) ----
        $toProcessQuery = fn () => Order::query()
            ->where('status', 'paid')
            ->whereIn('delivery_method', ['delivery', 'pickup'])
            ->whereIn('fulfillment_status', ['received', 'preparing']);

        $toProcess = $toProcessQuery()->with('user')->orderBy('paid_at')->limit(8)->get()
            ->map(fn (Order $o) => [
                'id' => $o->id,
                'customer' => $this->customerName($o),
                'total' => (int) $o->total,
                'currency' => $o->currency,
                'delivery_method' => $o->delivery_method,
                'fulfillment_status' => $o->fulfillment_status?->value,
                'paid_at' => $o->paid_at?->toIso8601String(),
            ])->values();

        $failed = Order::query()->with('user')->where('status', 'failed')->latest('id')->limit(5)->get()
            ->map(fn (Order $o) => [
                'id' => $o->id,
                'customer' => $this->customerName($o),
                'total' => (int) $o->total,
                'currency' => $o->currency,
                'created_at' => $o->created_at?->toIso8601String(),
            ])->values();

        $threshold = (int) config('shop.low_stock_threshold', 5);
        $lowStock = Product::query()->where('stock', '<=', $threshold)->orderBy('stock')->limit(5)
            ->get(['id', 'name', 'stock'])
            ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name, 'stock' => $p->stock])->values();

        $recent = Order::query()->with('user')->latest('id')->limit(6)->get()
            ->map(fn (Order $o) => [
                'id' => $o->id,
                'customer' => $this->customerName($o),
                'total' => (int) $o->total,
                'currency' => $o->currency,
                'status' => $o->status->value,
                'created_at' => $o->created_at?->toIso8601String(),
            ])->values();

        return [
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'days' => $days,
                'granularity' => $granularity,
                'previous_from' => $prevFrom->toDateString(),
                'previous_to' => $prevTo->toDateString(),
            ],
            'metrics' => $metrics,
            'snapshot' => [
                'revenue_total' => (int) Order::query()->where('status', 'paid')->sum('total'),
                'orders_to_process' => $toProcessQuery()->count(),
                'orders_pending' => Order::query()->where('status', 'pending')->count(),
                'orders_failed' => Order::query()->where('status', 'failed')->count(),
                'low_stock_count' => Product::query()->where('stock', '<=', $threshold)->count(),
                'products_total' => Product::query()->count(),
                'users_total' => User::query()->count(),
                'courses_total' => Course::query()->count(),
                'enrollments_total' => Enrollment::query()->count(),
            ],
            'series' => $series,
            'statuses' => $statuses,
            'sales_by_type' => $salesByType,
            'deliveries' => $deliveries,
            'top_cities' => $topCities,
            'top_products' => $topProducts,
            'top_courses' => $topCourses,
            'top_customers' => $topCustomers,
            'to_process' => $toProcess,
            'failed_orders' => $failed,
            'low_stock' => $lowStock,
            'recent_orders' => $recent,
        ];
    }

    /**
     * @return array<string, int|float>
     */
    private function periodFigures(Carbon $from, Carbon $to): array
    {
        $paid = $this->paidBetween($from, $to)->selectRaw('COUNT(*) as n, COALESCE(SUM(total), 0) as revenue')->first();
        $paidOrders = (int) ($paid->n ?? 0);
        $revenue = (int) ($paid->revenue ?? 0);

        $created = DB::table('orders')->whereBetween('created_at', [$from, $to])
            ->selectRaw("COUNT(*) as n, SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid")
            ->first();
        $createdCount = (int) ($created->n ?? 0);
        $createdPaid = (int) ($created->paid ?? 0);

        return [
            'revenue' => $revenue,
            'paid_orders' => $paidOrders,
            'avg_basket' => $paidOrders > 0 ? (int) round($revenue / $paidOrders) : 0,
            'orders_created' => $createdCount,
            'payment_rate' => $createdCount > 0 ? round($createdPaid / $createdCount * 100, 1) : 0,
            'new_customers' => User::query()->whereBetween('created_at', [$from, $to])->count(),
            'new_enrollments' => Enrollment::query()->whereBetween('created_at', [$from, $to])->count(),
        ];
    }

    /**
     * @return array{value: int|float, previous: int|float, change: float|null}
     */
    private function metric(int|float $current, int|float $previous): array
    {
        $change = null;
        if ($previous > 0) {
            $change = round(($current - $previous) / $previous * 100, 1);
        } elseif ($current === 0 || $current === 0.0) {
            $change = 0.0;
        }

        return ['value' => $current, 'previous' => $previous, 'change' => $change];
    }

    private function paidBetween(Carbon $from, Carbon $to): \Illuminate\Database\Query\Builder
    {
        return DB::table('orders')->where('status', 'paid')->whereBetween('paid_at', [$from, $to]);
    }

    private function bucket(string $column, string $granularity): string
    {
        $pg = $granularity === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
        $my = $granularity === 'month' ? '%Y-%m' : '%Y-%m-%d';

        return match (DB::connection()->getDriverName()) {
            'pgsql' => "to_char($column, '$pg')",
            'mysql', 'mariadb' => "DATE_FORMAT($column, '$my')",
            default => "strftime('$my', $column)",
        };
    }

    private function customerName(Order $o): string
    {
        return $o->user?->name ?? $o->guest_name ?? $o->guest_email ?? '—';
    }
}