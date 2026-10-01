<?php

namespace App\Http\Controllers\Admin;

use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\ActivityLogger;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $orders = $this->filteredQuery($request)->with(['user', 'items.itemable'])->latest('id')->paginate(20);

        return response()->json([
            'data' => OrderResource::collection($orders),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
                'counts' => $this->counts(),
            ],
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        $this->authorize('view', $order);

        $order->load(['user', 'items.itemable']);

        return response()->json([
            'data' => OrderResource::make($order),
        ]);
    }

    public function markPaid(
        Request $request,
        Order $order,
        OrderFulfillmentService $fulfillment,
        ActivityLogger $activity,
    ): JsonResponse {
        $this->authorize('manage', Order::class);

        $previousStatus = $order->status->value;

        try {
            $fulfillment->markPaid($order);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $activity->log(
            $request->user(),
            'order.marked_paid_manually',
            $order,
            [
                'previous_status' => $previousStatus,
                'order_total' => $order->total,
                'order_currency' => $order->currency,
            ],
        );

        return response()->json([
            'data' => OrderResource::make($order->fresh(['user', 'items.itemable'])),
        ]);
    }

    public function cancel(
        Request $request,
        Order $order,
        OrderFulfillmentService $fulfillment,
        ActivityLogger $activity,
    ): JsonResponse {
        $this->authorize('manage', Order::class);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $previousStatus = $order->status->value;

        try {
            $fulfillment->cancel($order);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $activity->log(
            $request->user(),
            'order.cancelled',
            $order,
            [
                'previous_status' => $previousStatus,
                'reason' => $data['reason'] ?? null,
                'order_total' => $order->total,
                'order_currency' => $order->currency,
            ],
        );

        return response()->json([
            'data' => OrderResource::make($order->fresh(['user', 'items.itemable'])),
        ]);
    }

    public function updateFulfillment(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $english = app()->getLocale() === 'en';

        if (! $order->isPaid()) {
            return response()->json([
                'message' => $english ? 'Only paid orders can be updated.' : 'Seule une commande payée peut être mise à jour.',
            ], 422);
        }

        $steps = array_map(
            fn (FulfillmentStatus $step): string => $step->value,
            FulfillmentStatus::stepsFor($order->delivery_method),
        );

        if ($steps === []) {
            return response()->json([
                'message' => $english ? 'This order has no delivery tracking.' : 'Aucun suivi de livraison pour cette commande.',
            ], 422);
        }

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in($steps)],
        ]);

        $previous = $order->fulfillment_status?->value;

        $order->update(['fulfillment_status' => $validated['status']]);

        $activity->log(
            $request->user(),
            'order.fulfillment_updated',
            $order,
            ['previous' => $previous, 'new' => $validated['status']],
        );

        return response()->json([
            'data' => OrderResource::make($order->fresh(['user', 'items.itemable'])),
        ]);
    }

    /**
     * Fait passer chaque commande payee selectionnee a son etape suivante.
     * Les commandes qui ne peuvent pas avancer (non payees, deja livrees, sans suivi) sont ignorees.
     */
    public function bulkAdvance(Request $request, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer'],
        ]);

        $updated = 0;
        $skipped = 0;

        $orders = Order::query()->whereIn('id', $data['ids'])->get();
        $skipped += count($data['ids']) - $orders->count();

        foreach ($orders as $order) {
            $steps = FulfillmentStatus::stepsFor($order->delivery_method);
            if (! $order->isPaid() || $steps === []) {
                $skipped++;

                continue;
            }

            $current = $order->fulfillment_status;
            $index = $current === null ? -1 : array_search($current, $steps, true);
            $next = $index === false ? $steps[0] : ($steps[$index + 1] ?? null);

            if ($next === null) {
                $skipped++;

                continue;
            }

            $order->update(['fulfillment_status' => $next]);
            $activity->log(
                $request->user(),
                'order.fulfillment_updated',
                $order,
                ['previous' => $current?->value, 'new' => $next->value, 'bulk' => true],
            );
            $updated++;
        }

        return response()->json(['data' => ['updated' => $updated, 'skipped' => $skipped]]);
    }

    /**
     * Compteurs des filtres rapides (independants de la recherche en cours).
     *
     * @return array<string, int>
     */
    private function counts(): array
    {
        $c = DB::table('orders')->selectRaw(
            "COUNT(*) as total,
            SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'paid' AND delivery_method IN ('delivery','pickup') AND fulfillment_status IN ('received','preparing') THEN 1 ELSE 0 END) as to_process,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today",
            [now()->startOfDay()],
        )->first();

        return [
            'all' => (int) ($c->total ?? 0),
            'paid' => (int) ($c->paid ?? 0),
            'pending' => (int) ($c->pending ?? 0),
            'failed' => (int) ($c->failed ?? 0),
            'cancelled' => (int) ($c->cancelled ?? 0),
            'to_process' => (int) ($c->to_process ?? 0),
            'today' => (int) ($c->today ?? 0),
        ];
    }

    private function filteredQuery(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $status = (string) $request->query('status', '');
        $quick = (string) $request->query('quick', '');
        $q = trim((string) $request->query('q', ''));
        $allowed = array_map(fn (OrderStatus $s): string => $s->value, OrderStatus::cases());

        return Order::query()
            ->when(in_array($status, $allowed, true), fn ($w) => $w->where('status', $status))
            ->when($quick === 'to_process', fn ($w) => $w
                ->where('status', 'paid')
                ->whereIn('delivery_method', ['delivery', 'pickup'])
                ->whereIn('fulfillment_status', ['received', 'preparing']))
            ->when($quick === 'today', fn ($w) => $w->where('created_at', '>=', now()->startOfDay()))
            ->when($q !== '', function ($w) use ($q): void {
                // Recherche insensible a la casse (LIKE est sensible a la casse sur PostgreSQL)
                $like = '%'.mb_strtolower(addcslashes($q, '%_\\')).'%';
                $id = ltrim($q, '#');
                $w->where(function ($x) use ($like, $id): void {
                    if (ctype_digit($id)) {
                        $x->orWhere('id', (int) $id);
                    }
                    $x->orWhereRaw('LOWER(guest_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(guest_email) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(phone) LIKE ?', [$like])
                        ->orWhereHas('user', fn ($u) => $u
                            ->whereRaw('LOWER(name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$like]));
                });
            });
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $this->authorize('manage', Order::class);

        $orders = $this->filteredQuery($request)->with('user')->latest('id')->limit(5000)->get();
        $filename = 'commandes-'.now()->format('Y-m-d').'.csv';

        // Neutralise les cellules interpretees comme formules par Excel
        $cell = function (mixed $v): string {
            $s = (string) ($v ?? '');

            return $s !== '' && in_array($s[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$s : $s;
        };

        return response()->streamDownload(function () use ($orders, $cell): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $put = fn (array $row) => fputcsv($out, $row, ';', '"', '\\');

            $put(['ID', 'Date', 'Client', 'Email', 'Telephone', 'Total', 'Devise', 'Statut', 'Date paiement',
                'Livraison', 'Zone', 'Ville', 'Quartier', 'Adresse', 'Repere', 'Suivi', 'Note']);

            foreach ($orders as $o) {
                $put([
                    $o->id,
                    $o->created_at?->format('Y-m-d H:i'),
                    $cell($o->user?->name ?? $o->guest_name),
                    $cell($o->user?->email ?? $o->guest_email),
                    $cell($o->phone),
                    $o->total,
                    $o->currency,
                    $o->status->value,
                    $o->paid_at?->format('Y-m-d H:i'),
                    $o->delivery_method,
                    $o->delivery_zone,
                    $cell($o->city),
                    $cell($o->district),
                    $cell($o->address),
                    $cell($o->landmark),
                    $o->fulfillment_status?->value,
                    $cell($o->note),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}