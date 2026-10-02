<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $seller = json_encode(config('invoice'), JSON_UNESCAPED_UNICODE);
        $seq = DB::table('invoice_sequences')->pluck('last_number', 'year')->all();
        $now = now();

        $orders = DB::table('orders')->whereNotNull('paid_at')->orderBy('paid_at')->orderBy('id')->get();

        foreach ($orders as $o) {
            if (DB::table('invoices')->where('order_id', $o->id)->exists()) {
                continue;
            }

            $year = (int) substr((string) $o->paid_at, 0, 4);
            $seq[$year] = ($seq[$year] ?? 0) + 1;

            $user = $o->user_id ? DB::table('users')->where('id', $o->user_id)->first() : null;

            $items = DB::table('order_items')->where('order_id', $o->id)->get()->map(function ($i): array {
                $isProduct = str_contains((string) $i->itemable_type, 'Product');
                $name = $isProduct
                    ? DB::table('products')->where('id', $i->itemable_id)->value('name')
                    : DB::table('courses')->where('id', $i->itemable_id)->value('title');

                return [
                    'name' => $name ?? 'Article',
                    'quantity' => (int) $i->quantity,
                    'unit_price' => (int) $i->unit_price,
                    'line_total' => (int) $i->line_total,
                ];
            })->values()->all();

            $delivery = (int) ($o->delivery_fee ?? 0);

            DB::table('invoices')->insert([
                'order_id' => $o->id,
                'number' => sprintf('FAC-%d-%06d', $year, $seq[$year]),
                'status' => $o->status === 'cancelled' ? 'cancelled' : 'issued',
                'issued_at' => $o->paid_at,
                'cancelled_at' => $o->status === 'cancelled' ? $now : null,
                'customer_name' => $user->name ?? $o->guest_name,
                'customer_email' => $user->email ?? $o->guest_email,
                'customer_phone' => $o->phone,
                'customer_address' => implode(', ', array_filter([$o->address, $o->district, $o->city, $o->landmark])),
                'currency' => $o->currency ?? 'XOF',
                'subtotal' => (int) ($o->subtotal ?? ((int) $o->total - $delivery)),
                'delivery_fee' => $delivery,
                'total' => (int) $o->total,
                'locale' => $o->locale ?? null,
                'items' => json_encode($items, JSON_UNESCAPED_UNICODE),
                'seller' => $seller,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        foreach ($seq as $year => $last) {
            DB::table('invoice_sequences')->updateOrInsert(['year' => $year], ['last_number' => $last]);
        }
    }

    public function down(): void
    {
        // Les numéros déjà attribués ne se reprennent pas : rien à défaire.
    }
};