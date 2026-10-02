<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class InvoiceIssuer
{
    /** Émet la facture de la commande (une seule fois). À appeler DANS la transaction de paiement. */
    public function issueFor(Order $order): Invoice
    {
        $existing = Invoice::query()->where('order_id', $order->id)->first();
        if ($existing !== null) {
            return $existing;
        }

        $order->loadMissing('items.itemable', 'user');

        $issuedAt = $order->paid_at ?? now();
        $delivery = (int) ($order->delivery_fee ?? 0);

        return Invoice::query()->create([
            'order_id' => $order->id,
            'number' => $this->nextNumber((int) $issuedAt->format('Y')),
            'status' => 'issued',
            'issued_at' => $issuedAt,
            'customer_name' => $order->user?->name ?? $order->guest_name,
            'customer_email' => $order->recipientEmail(),
            'customer_phone' => $order->phone,
            'customer_address' => implode(', ', array_filter([$order->address, $order->district, $order->city, $order->landmark])),
            'currency' => $order->currency ?: 'XOF',
            'subtotal' => (int) ($order->subtotal ?? ((int) $order->total - $delivery)),
            'delivery_fee' => $delivery,
            'total' => (int) $order->total,
            'locale' => $order->locale ?? null,
            'items' => $order->items->map(function ($i): array {
                $m = $i->itemable;

                return [
                    'name' => $m instanceof Product ? $m->name : ($m->title ?? $m->name ?? 'Article'),
                    'quantity' => (int) $i->quantity,
                    'unit_price' => (int) $i->unit_price,
                    'line_total' => (int) $i->line_total,
                ];
            })->values()->all(),
            'seller' => config('invoice'),
        ]);
    }

    public function cancelFor(Order $order): void
    {
        Invoice::query()
            ->where('order_id', $order->id)
            ->where('status', 'issued')
            ->update(['status' => 'cancelled', 'cancelled_at' => now()]);
    }

    /** Numéro sans trou : le compteur est verrouillé et annulé avec la transaction si elle échoue. */
    private function nextNumber(int $year): string
    {
        DB::table('invoice_sequences')->insertOrIgnore(['year' => $year, 'last_number' => 0]);

        $row = DB::table('invoice_sequences')->where('year', $year)->lockForUpdate()->first();
        $next = (int) $row->last_number + 1;

        DB::table('invoice_sequences')->where('year', $year)->update(['last_number' => $next]);

        return sprintf('FAC-%d-%06d', $year, $next);
    }
}