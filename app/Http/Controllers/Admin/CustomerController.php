<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\CustomerNote;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Clients = commandes regroupees par e-mail (compte ou invite), ou par telephone a defaut. */
class CustomerController extends Controller
{
    private const KEY = 'LOWER(COALESCE(users.email, orders.guest_email, orders.phone))';

    private function base(): Builder
    {
        return DB::table('orders')->leftJoin('users', 'users.id', '=', 'orders.user_id')
            ->whereRaw(self::KEY.' IS NOT NULL');
    }

    private function grouped(): Builder
    {
        return $this->base()->selectRaw(
            self::KEY." as ckey,
            MAX(COALESCE(users.name, orders.guest_name)) as name,
            MAX(COALESCE(users.email, orders.guest_email)) as email,
            MAX(orders.phone) as phone,
            MAX(users.id) as user_id,
            COUNT(*) as orders_count,
            SUM(CASE WHEN orders.status = 'paid' THEN 1 ELSE 0 END) as paid_count,
            COALESCE(SUM(CASE WHEN orders.status = 'paid' THEN orders.total ELSE 0 END), 0) as spent,
            MAX(orders.created_at) as last_order_at"
        )->groupByRaw(self::KEY);
    }

    private function search(Builder $q, string $term): void
    {
        if ($term === '') {
            return;
        }
        $like = '%'.mb_strtolower(addcslashes($term, '%_\\')).'%';
        $q->havingRaw(
            "LOWER(COALESCE(MAX(users.name), MAX(orders.guest_name), '')) LIKE ? OR ".self::KEY.' LIKE ? OR '
            ."LOWER(COALESCE(MAX(orders.phone), '')) LIKE ?",
            [$like, $like, $like],
        );
    }

    private function sorted(Builder $q, string $sort): void
    {
        match ($sort) {
            'orders' => $q->orderByRaw('orders_count DESC'),
            'recent' => $q->orderByRaw('last_order_at DESC'),
            'name' => $q->orderByRaw('name ASC'),
            default => $q->orderByRaw('spent DESC'),
        };
    }

    private function row(object $r): array
    {
        return [
            'key' => $r->ckey,
            'name' => $r->name,
            'email' => $r->email,
            'phone' => $r->phone,
            'user_id' => $r->user_id ? (int) $r->user_id : null,
            'orders_count' => (int) $r->orders_count,
            'paid_count' => (int) $r->paid_count,
            'spent' => (int) $r->spent,
            'avg_basket' => (int) $r->paid_count > 0 ? (int) round($r->spent / $r->paid_count) : 0,
            'last_order_at' => $r->last_order_at,
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $q = $this->grouped();
        $this->search($q, trim((string) $request->query('q', '')));

        $total = DB::query()->fromSub($q, 'c')->count();
        $page = max(1, (int) $request->query('page', 1));
        $this->sorted($q, (string) $request->query('sort', 'spent'));
        $rows = $q->forPage($page, 25)->get();

        return response()->json([
            'data' => $rows->map(fn ($r) => $this->row($r))->values(),
            'meta' => ['current_page' => $page, 'last_page' => max(1, (int) ceil($total / 25)), 'total' => $total],
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $key = mb_strtolower(trim((string) $request->query('key', '')));
        abort_if($key === '', 422, 'Client non précisé.');

        $summary = $this->grouped()->whereRaw(self::KEY.' = ?', [$key])->first();
        abort_if($summary === null, 404);

        $ids = $this->base()->whereRaw(self::KEY.' = ?', [$key])->pluck('orders.id');
        $orders = Order::query()->whereIn('id', $ids)->with('items.itemable')->latest('id')->limit(100)->get()
            ->map(fn (Order $o) => [
                'id' => $o->id,
                'public_ref' => $o->public_ref,
                'status' => $o->status->value,
                'fulfillment_status' => $o->fulfillment_status?->value,
                'total' => (int) $o->total,
                'currency' => $o->currency,
                'source' => $o->source,
                'items_count' => (int) $o->items->sum('quantity'),
                'created_at' => $o->created_at?->toIso8601String(),
            ])->values();

        $account = $summary->user_id ? User::query()->find($summary->user_id) : null;
        $addresses = $account ? Address::query()->where('user_id', $account->id)->get() : [];

        $notes = CustomerNote::query()->with('author:id,name')->where('customer_key', $key)->latest('id')->get()
            ->map(fn (CustomerNote $n) => [
                'id' => $n->id, 'body' => $n->body, 'author' => $n->author?->name,
                'user_id' => $n->user_id, 'created_at' => $n->created_at?->toIso8601String(),
            ])->values();

        return response()->json(['data' => $this->row($summary) + [
            'account' => $account ? [
                'id' => $account->id,
                'is_blocked' => (bool) $account->is_blocked,
                'is_student' => (bool) $account->is_student,
                'created_at' => $account->created_at?->toIso8601String(),
            ] : null,
            'addresses' => $addresses,
            'orders' => $orders,
            'notes' => $notes,
        ]]);
    }

    public function storeNote(Request $request): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $data = $request->validate([
            'key' => ['required', 'string', 'max:190'],
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $note = CustomerNote::query()->create([
            'customer_key' => mb_strtolower(trim($data['key'])),
            'user_id' => $request->user()->id,
            'body' => trim($data['body']),
        ]);

        return response()->json(['data' => [
            'id' => $note->id, 'body' => $note->body, 'author' => $request->user()->name,
            'user_id' => $note->user_id, 'created_at' => $note->created_at?->toIso8601String(),
        ]], 201);
    }

    public function destroyNote(Request $request, CustomerNote $note): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $me = $request->user();
        abort_unless($note->user_id === $me->id || $me->hasAdminScope('super'), 403, 'Seul l\'auteur peut supprimer cette note.');
        $note->delete();

        return response()->json(null, 204);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorize('manage', Order::class);

        $q = $this->grouped();
        $this->search($q, trim((string) $request->query('q', '')));
        $this->sorted($q, (string) $request->query('sort', 'spent'));
        $rows = $q->limit(5000)->get();

        $cell = function (mixed $v): string {
            $s = (string) ($v ?? '');

            return $s !== '' && in_array($s[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$s : $s;
        };

        return response()->streamDownload(function () use ($rows, $cell): void {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $put = fn (array $row) => fputcsv($out, $row, ';', '"', '\\');
            $put(['Nom', 'Email', 'Telephone', 'Compte', 'Commandes', 'Payees', 'Total depense', 'Panier moyen', 'Derniere commande']);
            foreach ($rows as $r) {
                $x = $this->row($r);
                $put([$cell($x['name']), $cell($x['email']), $cell($x['phone']), $x['user_id'] ? 'oui' : 'non',
                    $x['orders_count'], $x['paid_count'], $x['spent'], $x['avg_basket'], $x['last_order_at']]);
            }
            fclose($out);
        }, 'clients-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}