<?php

namespace App\Http\Controllers\Admin;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Order;
use App\Models\PaymentWebhookEvent;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CinetPayService;
use App\Services\OrderFulfillmentService;
use App\Services\PaymentAnomalyService;
use App\Services\PaymentGateway;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Page « Paiements » : une seule vue pour tout ce qui touche a l'argent des commandes. */
class PaymentController extends Controller
{
    private const TABS = ['to_verify', 'pending', 'failed', 'anomalies', 'paid_today', 'all'];

    /** Nombre maximum de commandes relues aupres de CinetPay par clic sur « Tout verifier ». */
    private const VERIFY_BATCH = 25;

    private const HISTORY_ACTIONS = [
        'order.payment_claimed',
        'order.payment_claim_rejected',
        'order.payment_checked',
        'order.marked_paid_manually',
        'order.payment_anomaly_flagged',
        'order.payment_anomaly_resolved',
        'order.refunded',
        'order.cancelled',
        'order.stock_conflict_resolved',
    ];

    private const ACTION_LABELS = [
        'order.payment_claimed' => 'Le client déclare avoir payé',
        'order.payment_claim_rejected' => 'Déclaration rejetée',
        'order.payment_checked' => 'Vérification auprès de CinetPay',
        'order.marked_paid_manually' => 'Validé manuellement',
        'order.payment_anomaly_flagged' => 'Anomalie signalée',
        'order.payment_anomaly_resolved' => 'Anomalie traitée',
        'order.refunded' => 'Marqué remboursé',
        'order.cancelled' => 'Commande annulée',
        'order.stock_conflict_resolved' => 'Conflit de stock résolu',
    ];

    public function index(Request $request): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $orders = $this->filteredQuery($request, $this->tab($request))
            ->with('user')
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => $orders->getCollection()->map(fn (Order $o): array => $this->row($o))->values(),
            'meta' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'total' => $orders->total(),
                'counts' => $this->counts(),
            ],
        ]);
    }

    public function history(Order $order): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $entries = [];
        $tx = $order->payment_transaction_id;

        if ($tx) {
            try {
                $events = PaymentWebhookEvent::query()
                    ->where(function (Builder $w) use ($tx): void {
                        $w->where('event_key', 'like', '%'.addcslashes((string) $tx, '%_\\').'%')
                            ->orWhere('payload->cpm_trans_id', $tx)
                            ->orWhere('payload->transaction_id', $tx);
                    })
                    ->latest('id')->limit(50)->get();
            } catch (\Throwable) {
                // Colonne payload non JSON : on se rabat sur la cle d'evenement seule
                $events = PaymentWebhookEvent::query()
                    ->where('event_key', 'like', '%'.addcslashes((string) $tx, '%_\\').'%')
                    ->latest('id')->limit(50)->get();
            }

            foreach ($events as $e) {
                $payload = is_array($e->payload) ? $e->payload : [];
                $parts = [];
                foreach (['cpm_result' => 'résultat', 'cpm_trans_status' => 'statut', 'cpm_amount' => 'montant', 'cpm_currency' => 'devise', 'payment_method' => 'moyen', 'cpm_error_message' => 'message'] as $key => $label) {
                    if (isset($payload[$key]) && $payload[$key] !== '') {
                        $parts[] = $label.' : '.(is_scalar($payload[$key]) ? $payload[$key] : json_encode($payload[$key]));
                    }
                }

                $entries[] = [
                    'id' => 'w'.$e->id,
                    'kind' => 'webhook',
                    'label' => 'Webhook reçu ('.$e->provider.')',
                    'at' => $this->iso($e->created_at),
                    'detail' => $parts === [] ? null : implode(' · ', $parts),
                ];
            }
        }

        $logs = ActivityLog::query()
            ->where('subject_type', $order->getMorphClass())
            ->where('subject_id', $order->getKey())
            ->whereIn('action', self::HISTORY_ACTIONS)
            ->latest('id')->limit(50)->get();

        foreach ($logs as $log) {
            $m = is_array($log->metadata) ? $log->metadata : [];
            $detail = $m['message'] ?? $m['reason'] ?? $m['note'] ?? $m['reference'] ?? $m['payment_reference'] ?? null;

            $entries[] = [
                'id' => 'a'.$log->id,
                'kind' => 'activity',
                'label' => self::ACTION_LABELS[$log->action] ?? $log->action,
                'at' => $this->iso($log->created_at),
                'detail' => is_scalar($detail) ? (string) $detail : null,
            ];
        }

        usort($entries, fn (array $a, array $b): int => strcmp((string) $b['at'], (string) $a['at']));

        return response()->json(['data' => $entries]);
    }

    public function verify(
        Request $request,
        Order $order,
        OrderFulfillmentService $fulfillment,
        ActivityLogger $activity,
        PaymentAnomalyService $anomalies,
    ): JsonResponse {
        $this->authorize('manage', Order::class);

        $result = $this->verifyOrder($order, $fulfillment, $activity, $anomalies, $request->user());

        return response()->json(['data' => $result + ['order' => $this->row($order->fresh('user'))]]);
    }

    public function verifyAll(
        Request $request,
        OrderFulfillmentService $fulfillment,
        ActivityLogger $activity,
        PaymentAnomalyService $anomalies,
    ): JsonResponse {
        $this->authorize('manage', Order::class);

        @set_time_limit(180);

        $base = Order::query()
            ->whereNotNull('payment_transaction_id')
            ->where(function (Builder $w): void {
                $w->where('status', 'pending')
                    ->orWhere(fn (Builder $x) => $x->where('status', 'failed')->whereNotNull('payment_claimed_at'));
            });

        $total = (clone $base)->count();

        // Les commandes jamais verifiees (ou verifiees le plus anciennement) passent en premier
        $orders = $base
            ->orderByRaw('payment_checked_at IS NOT NULL')
            ->orderBy('payment_checked_at')
            ->orderBy('id')
            ->limit(self::VERIFY_BATCH)
            ->get();

        $summary = [];
        foreach ($orders as $order) {
            $r = $this->verifyOrder($order, $fulfillment, $activity, $anomalies, $request->user());
            $summary[$r['result']] = ($summary[$r['result']] ?? 0) + 1;
        }

        return response()->json(['data' => [
            'checked' => $orders->count(),
            'remaining' => max(0, $total - $orders->count()),
            'summary' => $summary,
        ]]);
    }

    public function rejectClaim(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate(['reason' => ['nullable', 'string', 'max:300']]);

        if ($order->isPaid()) {
            return response()->json(['message' => 'Cette commande est déjà payée.'], 422);
        }

        $previousReference = null;

        try {
            DB::transaction(function () use ($order, $data, &$previousReference): void {
                $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

                if ($locked->payment_claimed_at === null) {
                    throw new \RuntimeException('Aucune déclaration de paiement à rejeter pour cette commande.');
                }

                $previousReference = $locked->payment_claimed_reference;

                $locked->forceFill([
                    'payment_claimed_at' => null,
                    'payment_claimed_reference' => null,
                    'payment_claim_rejected_at' => now(),
                    'payment_claim_rejected_reason' => $data['reason'] ?? null,
                ])->save();
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $activity->log($request->user(), 'order.payment_claim_rejected', $order, [
            'reason' => $data['reason'] ?? null,
            'reference' => $previousReference,
            'order_total' => $order->total,
        ]);

        return response()->json(['data' => $this->row($order->fresh('user'))]);
    }

    /** Suivi manuel : aucun appel a la passerelle, on note simplement que l'argent a ete rendu. */
    public function refund(Request $request, Order $order, ActivityLogger $activity): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);

        if (! $order->isPaid()) {
            return response()->json(['message' => 'Seule une commande payée peut être marquée remboursée.'], 422);
        }

        if ($order->getAttribute('refunded_at') !== null) {
            return response()->json(['message' => 'Cette commande est déjà marquée remboursée.'], 422);
        }

        $order->forceFill([
            'refunded_at' => now(),
            'refund_reason' => $data['reason'],
            'refunded_by' => $request->user()->getKey(),
        ])->save();

        $activity->log($request->user(), 'order.refunded', $order, [
            'reason' => $data['reason'],
            'order_total' => $order->total,
            'order_currency' => $order->currency,
        ]);

        return response()->json(['data' => $this->row($order->fresh('user'))]);
    }

    public function resolveAnomaly(Request $request, Order $order, PaymentAnomalyService $anomalies): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate(['note' => ['nullable', 'string', 'max:300']]);

        if ($order->getAttribute('payment_anomaly') === null) {
            return response()->json(['message' => 'Aucune anomalie à traiter sur cette commande.'], 422);
        }

        $anomalies->clear($order, $request->user(), $data['note'] ?? null);

        return response()->json(['data' => $this->row($order->fresh('user'))]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorize('manage', Order::class);

        $orders = $this->filteredQuery($request, $this->tab($request))->with('user')->latest('id')->limit(5000)->get();
        $filename = 'paiements-'.now()->format('Y-m-d').'.csv';

        // Neutralise les cellules interpretees comme formules par Excel
        $cell = function (mixed $v): string {
            $s = (string) ($v ?? '');

            return $s !== '' && in_array($s[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$s : $s;
        };

        return response()->streamDownload(function () use ($orders, $cell): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $put = fn (array $row) => fputcsv($out, $row, ';', '"', '\\');

            $put(['ID', 'Référence', 'Date commande', 'Client', 'Email', 'Téléphone', 'Total', 'Devise', 'Statut',
                'Moyen de paiement', 'Référence paiement', 'Transaction', 'Déclaré le', 'Payé le',
                'Anomalie', 'Détail anomalie', 'Remboursé le', 'Motif remboursement']);

            foreach ($orders as $o) {
                $put([
                    $o->id,
                    $cell($o->public_ref),
                    $o->created_at?->format('Y-m-d H:i'),
                    $cell($o->user?->name ?? $o->guest_name),
                    $cell($o->user?->email ?? $o->guest_email),
                    $cell($o->phone),
                    $o->total,
                    $o->currency,
                    $o->status->value,
                    $cell($o->getAttribute('payment_method')),
                    $cell($o->getAttribute('payment_reference') ?? $o->payment_claimed_reference),
                    $cell($o->payment_transaction_id),
                    $this->iso($o->payment_claimed_at, 'Y-m-d H:i'),
                    $this->iso($o->paid_at, 'Y-m-d H:i'),
                    $cell($o->getAttribute('payment_anomaly') ?? ($o->stock_conflict ? 'stock_missing' : '')),
                    $cell($o->getAttribute('payment_anomaly_note')),
                    $this->iso($o->getAttribute('refunded_at'), 'Y-m-d H:i'),
                    $cell($o->getAttribute('refund_reason')),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    // ------------------------------------------------------------------ interne

    /**
     * Relit le vrai statut chez CinetPay et applique le resultat.
     *
     * @return array{result: string, message: string}
     */
    private function verifyOrder(
        Order $order,
        OrderFulfillmentService $fulfillment,
        ActivityLogger $activity,
        PaymentAnomalyService $anomalies,
        ?User $actor,
    ): array {
        if ($order->isPaid()) {
            return ['result' => 'already_paid', 'message' => 'Cette commande est déjà payée.'];
        }

        $tx = $order->payment_transaction_id;
        if (! $tx) {
            return ['result' => 'no_transaction', 'message' => 'Aucune transaction CinetPay liée à cette commande (paiement manuel ?).'];
        }

        // Evite de reboucler sur la meme commande dans « Tout verifier », meme si la passerelle ne repond pas
        $order->forceFill(['payment_checked_at' => now()])->save();

        try {
            $res = $this->gateway()->checkTransactionStatus((string) $tx);
        } catch (\RuntimeException $e) {
            return ['result' => 'error', 'message' => 'Vérification impossible : '.$e->getMessage()];
        }

        $data = is_array($res['data'] ?? null) ? $res['data'] : [];
        $code = (string) ($res['code'] ?? '');
        $gwStatus = strtoupper((string) ($data['status'] ?? ''));

        if ($code === '00' && $gwStatus === 'ACCEPTED') {
            $paidAmount = (int) round((float) ($data['amount'] ?? 0));
            $expected = (int) $order->total;
            $currencyOk = strtoupper((string) ($data['currency'] ?? $order->currency)) === strtoupper((string) $order->currency);

            if ($paidAmount !== $expected || ! $currencyOk) {
                $note = "CinetPay a encaissé {$paidAmount} ".($data['currency'] ?? '').", la commande vaut {$expected} {$order->currency}.";
                $anomalies->flag($order, PaymentAnomalyService::AMOUNT_MISMATCH, $note, ['source' => 'verify'], $actor);

                return $this->logged($activity, $actor, $order, 'anomaly', 'Montant incohérent : '.$note, $gwStatus);
            }

            try {
                // POINT D'ADAPTATION : meme appel que le webhook (methode/source) si elle differe
                $fulfillment->markPaid($order, [
                    'method' => 'cinetpay',
                    'reference' => (string) ($data['operator_id'] ?? $tx),
                    'amount' => $paidAmount,
                    'source' => 'cinetpay_check',
                    'paid_by' => null,
                ]);
            } catch (InsufficientStockException $e) {
                $anomalies->flag($order, PaymentAnomalyService::STOCK_MISSING, $e->getMessage(), ['source' => 'verify'], $actor);

                return $this->logged($activity, $actor, $order, 'anomaly', 'Paiement confirmé mais stock insuffisant : commande marquée en anomalie.', $gwStatus);
            } catch (\RuntimeException $e) {
                return ['result' => 'error', 'message' => 'Paiement confirmé chez CinetPay, mais impossible de l\'appliquer : '.$e->getMessage()];
            }

            $anomalies->clear($order->fresh(), $actor, 'Paiement confirmé par CinetPay');

            return $this->logged($activity, $actor, $order, 'paid', 'Paiement confirmé par CinetPay : commande marquée payée.', $gwStatus);
        }

        if ($code === '627') {
            return $this->logged($activity, $actor, $order, 'not_found', 'Transaction introuvable chez CinetPay.', $gwStatus ?: $code);
        }

        if ($gwStatus === 'REFUSED') {
            // POINT D'ADAPTATION : si le service sait deja passer une commande en « echouee » (liberation du stock), appelle-le ici
            if (method_exists($fulfillment, 'markFailed')) {
                try {
                    $fulfillment->markFailed($order);
                } catch (\Throwable $e) {
                    report($e);
                }
            }

            return $this->logged($activity, $actor, $order, 'refused', 'CinetPay indique que le paiement a été refusé.', $gwStatus);
        }

        return $this->logged($activity, $actor, $order, 'waiting', 'Le client n\'a pas encore finalisé le paiement chez CinetPay.', $gwStatus ?: $code);
    }

    /** @return array{result: string, message: string} */
    private function logged(ActivityLogger $activity, ?User $actor, Order $order, string $result, string $message, string $gateway): array
    {
        try {
            $activity->log($actor, 'order.payment_checked', $order, [
                'result' => $result,
                'gateway_status' => $gateway,
                'message' => $message,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        return ['result' => $result, 'message' => $message];
    }

    private function gateway(): PaymentGateway
    {
        return app()->bound(PaymentGateway::class) ? app(PaymentGateway::class) : app(CinetPayService::class);
    }

    private function tab(Request $request): string
    {
        $tab = (string) $request->query('tab', 'to_verify');

        return in_array($tab, self::TABS, true) ? $tab : 'all';
    }

    private function scopeTab(Builder $q, string $tab): Builder
    {
        $now = now();

        return match ($tab) {
            'to_verify' => $q->whereIn('status', ['pending', 'failed'])->whereNotNull('payment_claimed_at'),
            'pending' => $q->where('status', 'pending')->whereNull('payment_claimed_at')
                ->where(fn (Builder $w) => $w->whereNull('reservation_expires_at')->orWhere('reservation_expires_at', '>', $now)),
            'failed' => $q->whereNull('payment_claimed_at')
                ->where(fn (Builder $w) => $w->where('status', 'failed')
                    ->orWhere(fn (Builder $x) => $x->where('status', 'pending')
                        ->whereNotNull('reservation_expires_at')->where('reservation_expires_at', '<=', $now))),
            'anomalies' => $q->where(fn (Builder $w) => $w->where('stock_conflict', true)->orWhereNotNull('payment_anomaly')),
            'paid_today' => $q->where('status', 'paid')->where('paid_at', '>=', $now->copy()->startOfDay()),
            default => $q,
        };
    }

    private function filteredQuery(Request $request, string $tab): Builder
    {
        $q = trim((string) $request->query('q', ''));
        $from = (string) $request->query('from', '');
        $to = (string) $request->query('to', '');

        return $this->scopeTab(Order::query(), $tab)
            ->when(preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) === 1, fn ($w) => $w->whereRaw('COALESCE(paid_at, created_at) >= ?', [$from.' 00:00:00']))
            ->when(preg_match('/^\d{4}-\d{2}-\d{2}$/', $to) === 1, fn ($w) => $w->whereRaw('COALESCE(paid_at, created_at) <= ?', [$to.' 23:59:59']))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.mb_strtolower(addcslashes($q, '%_\\')).'%';
                $id = ltrim($q, '#');
                $w->where(function ($x) use ($like, $id): void {
                    if (ctype_digit($id)) {
                        $x->orWhere('id', (int) $id);
                    }
                    $x->orWhereRaw('LOWER(public_ref) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(guest_name) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(guest_email) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(phone) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(payment_transaction_id) LIKE ?', [$like])
                        ->orWhereRaw('LOWER(payment_claimed_reference) LIKE ?', [$like])
                        ->orWhereHas('user', fn ($u) => $u
                            ->whereRaw('LOWER(name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(email) LIKE ?', [$like]));
                });
            });
    }

    /** @return array<string, int> */
    private function counts(): array
    {
        $counts = [];
        foreach (['to_verify', 'pending', 'failed', 'anomalies', 'paid_today'] as $tab) {
            $counts[$tab] = $this->scopeTab(Order::query(), $tab)->count();
        }

        $counts['collected_today'] = (int) $this->scopeTab(Order::query(), 'paid_today')->sum('total');

        return $counts;
    }

    /** @return array<string, mixed> */
    private function row(Order $o): array
    {
        $status = $o->status->value;
        $claimed = $o->payment_claimed_at !== null;
        $expired = $status === 'pending' && $o->reservation_expires_at !== null && $o->reservation_expires_at->lte(now());

        $bucket = match (true) {
            $status === 'paid' => 'paid',
            $status === 'cancelled' => 'cancelled',
            $claimed => 'to_verify',
            $status === 'failed' || $expired => 'failed',
            default => 'pending',
        };

        return [
            'id' => $o->id,
            'public_ref' => $o->public_ref,
            'customer' => $o->user?->name ?? $o->guest_name,
            'email' => $o->user?->email ?? $o->guest_email,
            'phone' => $o->phone,
            'total' => (int) $o->total,
            'currency' => $o->currency,
            'status' => $status,
            'bucket' => $bucket,
            'created_at' => $this->iso($o->created_at),
            'paid_at' => $this->iso($o->paid_at),
            'payment_method' => $o->getAttribute('payment_method'),
            'payment_reference' => $o->getAttribute('payment_reference'),
            'payment_transaction_id' => $o->payment_transaction_id,
            'claimed_at' => $this->iso($o->payment_claimed_at),
            'claimed_reference' => $o->payment_claimed_reference,
            'claim_rejected_at' => $this->iso($o->getAttribute('payment_claim_rejected_at')),
            'claim_rejected_reason' => $o->getAttribute('payment_claim_rejected_reason'),
            'checked_at' => $this->iso($o->getAttribute('payment_checked_at')),
            'stock_conflict' => (bool) $o->stock_conflict,
            'anomaly' => $o->getAttribute('payment_anomaly'),
            'anomaly_note' => $o->getAttribute('payment_anomaly_note'),
            'refunded_at' => $this->iso($o->getAttribute('refunded_at')),
            'refund_reason' => $o->getAttribute('refund_reason'),
            'reservation_expires_at' => $this->iso($o->reservation_expires_at),
        ];
    }

    private function iso(mixed $value, ?string $format = null): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $date = $value instanceof Carbon ? $value : Carbon::parse($value);

        return $format ? $date->format($format) : $date->toIso8601String();
    }
}