<?php

namespace App\Support\Export\Definitions;

use App\Models\Order;
use App\Support\Export\ExportDefinition;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/** Export seul (donnees comptables et personnelles). Aucune preuve de paiement, aucun token. */
class OrderExport extends ExportDefinition
{
    public function key(): string { return 'orders'; }
    public function label(): string { return 'Commandes'; }
    public function scope(): string { return 'shop'; }
    public function ability(): ?array { return ['manage', Order::class]; }

    public function query(Request $request): Builder
    {
        $q = Order::query()->with('user:id,name,email')
            ->when($request->filled('status'), fn ($w) => $w->where('status', (string) $request->query('status')));

        return $this->dateRange($q, $request);
    }

    public function columns(): array
    {
        return [
            'id' => fn (Order $o) => $o->id,
            'reference' => fn (Order $o) => $o->public_ref,
            'date' => fn (Order $o) => $o->created_at,
            'client' => fn (Order $o) => $o->user?->name ?? $o->guest_name,
            'email' => fn (Order $o) => $o->user?->email ?? $o->guest_email,
            'telephone' => fn (Order $o) => $o->phone,
            'sous_total' => fn (Order $o) => (int) $o->subtotal,
            'frais_livraison' => fn (Order $o) => (int) $o->delivery_fee,
            'total' => fn (Order $o) => (int) $o->total,
            'devise' => fn (Order $o) => $o->currency,
            'statut' => fn (Order $o) => $o->status,
            'paye_le' => fn (Order $o) => $o->paid_at,
            'moyen_paiement' => fn (Order $o) => $o->payment_method,
            'livraison' => fn (Order $o) => $o->delivery_method,
            'zone' => fn (Order $o) => $o->delivery_zone,
            'pays' => fn (Order $o) => $o->country ?? 'SN',
            'ville' => fn (Order $o) => $o->city,
            'quartier' => fn (Order $o) => $o->district,
            'adresse' => fn (Order $o) => $o->address,
            'repere' => fn (Order $o) => $o->landmark,
            'suivi' => fn (Order $o) => $o->fulfillment_status,
            'note' => fn (Order $o) => $o->note,
        ];
    }
}