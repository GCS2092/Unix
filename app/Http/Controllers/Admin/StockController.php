<?php

namespace App\Http\Controllers\Admin;

use App\Enums\StockMovementReason;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StockController extends Controller
{
    /** Vue d'ensemble : chiffres clés + liste filtrable des produits avec leur stock. */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $threshold = (int) config('shop.low_stock_threshold', 5);
        $products = $this->filtered($request, $threshold)->paginate(25);

        return response()->json([
            'data' => $products->getCollection()->map(fn (Product $p): array => $this->row($p, $threshold))->values(),
            'summary' => $this->summary($threshold),
            'meta' => [
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'total' => $products->total(),
            ],
        ]);
    }

    /** Journal global des mouvements (tous produits). */
    public function movements(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Product::class);

        $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'product_id' => ['nullable', 'integer'],
        ]);

        $reasons = array_map(fn (StockMovementReason $r): string => $r->value, StockMovementReason::cases());
        $reason = (string) $request->query('reason', '');
        $productId = (int) $request->query('product_id', 0);
        $from = $request->query('from');
        $to = $request->query('to');

        $movements = StockMovement::query()
            ->with([
                'product' => fn ($q) => $q->without('images')->select('id', 'name', 'slug'),
                'user:id,name',
            ])
            ->when(in_array($reason, $reasons, true), fn ($q) => $q->where('reason', $reason))
            ->when($productId > 0, fn ($q) => $q->where('product_id', $productId))
            ->when($from, fn ($q) => $q->where('created_at', '>=', Carbon::parse((string) $from)->startOfDay()))
            ->when($to, fn ($q) => $q->where('created_at', '<=', Carbon::parse((string) $to)->endOfDay()))
            ->latest('id')
            ->paginate(30);

        return response()->json([
            'data' => $movements->getCollection()->map(fn (StockMovement $m): array => [
                'id' => $m->id,
                'reason' => $m->reason->value,
                'quantity_change' => $m->quantity_change,
                'stock_after' => $m->stock_after,
                'note' => $m->note,
                'admin' => $m->user?->name,
                'order_id' => $m->order_id,
                'product' => $m->product ? ['id' => $m->product->id, 'name' => $m->product->name, 'slug' => $m->product->slug] : null,
                'created_at' => $m->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $movements->currentPage(),
                'last_page' => $movements->lastPage(),
                'total' => $movements->total(),
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorize('viewAny', Product::class);

        $threshold = (int) config('shop.low_stock_threshold', 5);
        $products = $this->filtered($request, $threshold)->limit(5000)->get();
        $filename = 'stock-'.now()->format('Y-m-d').'.csv';

        $cell = function (mixed $v): string {
            $s = (string) ($v ?? '');

            return $s !== '' && in_array($s[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$s : $s;
        };

        return response()->streamDownload(function () use ($products, $threshold, $cell): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $put = fn (array $row) => fputcsv($out, $row, ';', '"', '\\');

            $put(['ID', 'Produit', 'Prix', 'Stock', 'Reserve', 'Valeur du stock', 'Etat', 'Publie']);

            foreach ($products as $p) {
                $r = $this->row($p, $threshold);
                $put([$r['id'], $cell($r['name']), $r['price'], $r['stock'], $r['reserved'], $r['value'], $r['status'], $r['is_published'] ? 'oui' : 'non']);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** Unités détenues par des commandes en attente, par produit. */
    private function reservedByProduct(): \Illuminate\Database\Query\Builder
    {
        $types = array_unique([Product::class, (new Product)->getMorphClass()]);

        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.stock_reserved', true)
            ->where('orders.status', 'pending')
            ->whereIn('order_items.itemable_type', $types)
            ->groupBy('order_items.itemable_id')
            ->selectRaw('order_items.itemable_id as product_id, SUM(order_items.quantity) as qty');
    }

    private function filtered(Request $request, int $threshold): Builder
    {
        $q = trim((string) $request->query('q', ''));
        $filter = (string) $request->query('filter', '');
        $sort = (string) $request->query('sort', 'stock_asc');

        $query = Product::query()
            ->without('images')
            ->leftJoinSub($this->reservedByProduct(), 'r', 'r.product_id', '=', 'products.id')
            ->select('products.*')
            ->selectRaw('COALESCE(r.qty, 0) as reserved_qty');

        $query
            ->when($q !== '', function (Builder $w) use ($q): void {
                $like = '%'.mb_strtolower(addcslashes($q, '%_\\')).'%';
                $w->where(fn (Builder $x) => $x
                    ->whereRaw('LOWER(products.name) LIKE ?', [$like])
                    ->orWhereRaw("LOWER(COALESCE(products.name_en, '')) LIKE ?", [$like])
                    ->orWhereRaw('LOWER(products.slug) LIKE ?', [$like]));
            })
            ->when($filter === 'out', fn (Builder $w) => $w->where('products.stock', '<=', 0))
            ->when($filter === 'low', fn (Builder $w) => $w->where('products.stock', '>', 0)->where('products.stock', '<=', $threshold))
            ->when($filter === 'reserved', fn (Builder $w) => $w->where('r.qty', '>', 0))
            ->when($filter === 'unpublished', fn (Builder $w) => $w->where('products.is_published', false));

        match ($sort) {
            'stock_desc' => $query->orderByDesc('products.stock'),
            'name' => $query->orderBy('products.name'),
            'recent' => $query->orderByDesc('products.id'),
            default => $query->orderBy('products.stock'),
        };

        return $query->orderBy('products.id');
    }

    /** @return array<string, mixed> */
    private function row(Product $p, int $threshold): array
    {
        $stock = (int) $p->stock;

        return [
            'id' => $p->id,
            'name' => $p->name,
            'slug' => $p->slug,
            'image_url' => $p->imageUrl(),
            'price' => (int) $p->price,
            'stock' => $stock,
            'reserved' => (int) $p->reserved_qty,
            'value' => $stock * (int) $p->price,
            'status' => $stock <= 0 ? 'out' : ($stock <= $threshold ? 'low' : 'ok'),
            'is_published' => (bool) $p->is_published,
        ];
    }

    /** @return array<string, int> */
    private function summary(int $threshold): array
    {
        $a = DB::table('products')->selectRaw(
            'COUNT(*) as products_total,
            COALESCE(SUM(stock), 0) as units,
            COALESCE(SUM(stock * price), 0) as value,
            SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_count,
            SUM(CASE WHEN stock > 0 AND stock <= ? THEN 1 ELSE 0 END) as low_count,
            SUM(CASE WHEN is_published AND stock <= 0 THEN 1 ELSE 0 END) as published_out',
            [$threshold],
        )->first();

        return [
            'products_total' => (int) ($a->products_total ?? 0),
            'units' => (int) ($a->units ?? 0),
            'value' => (int) ($a->value ?? 0),
            'out_count' => (int) ($a->out_count ?? 0),
            'low_count' => (int) ($a->low_count ?? 0),
            'published_out' => (int) ($a->published_out ?? 0),
            'reserved_units' => (int) DB::query()->fromSub($this->reservedByProduct(), 'r')->sum('qty'),
            'conflicts' => (int) DB::table('orders')->where('stock_conflict', true)->count(),
            'low_stock_threshold' => $threshold,
        ];
    }
}
