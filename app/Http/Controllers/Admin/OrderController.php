<?php

namespace App\Http\Controllers\Admin;

use App\Enums\FulfillmentStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\ActivityLogger;
use App\Services\OrderFulfillmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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

    public function updateFulfillment(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        abort_unless($order->status->value === 'paid', 422, 'Commande non payée.');
        $this->authorize('manage', Order::class);

        $english = app()->getLocale() === 'en';

        if (! $order->isPaid()) {
            return response()->json([
                'message' => $english ? 'Only paid orders can be updated.' : 'Seule une commande payee peut etre mise a jour.',
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

    private function filteredQuery(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $status = (string) $request->query('status', '');
        $q = trim((string) $request->query('q', ''));
        $allowed = array_map(fn (\App\Enums\OrderStatus $s): string => $s->value, \App\Enums\OrderStatus::cases());

        return Order::query()
            ->when(in_array($status, $allowed, true), fn ($w) => $w->where('status', $status))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $id = ltrim($q, '#');
                $w->where(function ($x) use ($like, $id): void {
                    if (ctype_digit($id)) {
                        $x->orWhere('id', (int) $id);
                    }
                    $x->orWhere('guest_name', 'like', $like)
                        ->orWhere('guest_email', 'like', $like)
                        ->orWhere('phone', 'like', $like)
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like));
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
