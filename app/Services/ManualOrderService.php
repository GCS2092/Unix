<?php

namespace App\Services;

use App\Enums\FulfillmentStatus;
use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** Commande saisie par l'equipe (WhatsApp, telephone, boutique physique). */
class ManualOrderService
{
    public const SOURCES = ['whatsapp', 'phone', 'shop', 'other'];

    public const PAYMENT_METHODS = ['cash', 'wave', 'orange_money', 'free_money', 'card', 'transfer', 'other'];

    public function __construct(
        private readonly StockService $stock,
        private readonly OrderFulfillmentService $fulfillment,
        private readonly ActivityLogger $activity,
    ) {}

    /**
     * @param  array<string, mixed>  $d  donnees validees par ManualOrderController
     *
     * @throws \App\Exceptions\InsufficientStockException
     */
    public function create(User $admin, array $d): Order
    {
        $paid = (bool) ($d['paid'] ?? false);
        if ($paid && empty($d['payment_method'])) {
            throw ValidationException::withMessages(['payment_method' => 'Indique le moyen de paiement reçu.']);
        }

        $customer = ! empty($d['user_id']) ? User::query()->findOrFail((int) $d['user_id']) : null;
        [$method, $zone, $fee] = $this->delivery($d);
        if (isset($d['delivery_fee'])) {
            $fee = (int) $d['delivery_fee'];
        }

        $qty = [];
        $price = [];
        foreach ($d['items'] as $i) {
            $id = (int) $i['product_id'];
            $qty[$id] = ($qty[$id] ?? 0) + (int) $i['quantity'];
            if (isset($i['unit_price'])) {
                $price[$id] = (int) $i['unit_price'];
            }
        }

        $order = DB::transaction(function () use ($d, $customer, $method, $zone, $fee, $qty, $price, $admin): Order {
            $products = Product::query()->without('images')->whereIn('id', array_keys($qty))->get()->keyBy('id');
            if ($products->count() !== count($qty)) {
                throw ValidationException::withMessages(['items' => 'Un produit est introuvable.']);
            }

            $subtotal = 0;
            $lines = [];
            foreach ($qty as $id => $q) {
                $unit = $price[$id] ?? (int) $products[$id]->price;
                $lines[] = ['product' => $products[$id], 'quantity' => $q, 'unit' => $unit, 'total' => $unit * $q];
                $subtotal += $unit * $q;
            }

            $order = Order::query()->create([
                'user_id' => $customer?->id,
                'guest_email' => $customer ? null : ($d['guest_email'] ?? null),
                'guest_name' => $customer ? null : ($d['guest_name'] ?? null),
                'status' => OrderStatus::Pending,
                'subtotal' => $subtotal,
                'delivery_fee' => $fee,
                'total' => $subtotal + $fee,
                'currency' => 'XOF',
                'payment_transaction_id' => 'MAN-'.Str::uuid()->toString(),
                'locale' => 'fr',
                'phone' => $d['phone'],
                'country' => $d['country'] ?? 'SN',
                'delivery_method' => $method,
                'delivery_zone' => $zone,
                'city' => $method === 'delivery' ? ($d['city'] ?? null) : null,
                'district' => $method === 'delivery' ? ($d['district'] ?? null) : null,
                'address' => $method === 'delivery' ? ($d['address'] ?? null) : null,
                'landmark' => $method === 'delivery' ? ($d['landmark'] ?? null) : null,
                'note' => $d['note'] ?? null,
                'source' => $d['source'],
                'payment_method' => $d['payment_method'] ?? null,
                'created_by' => $admin->id,
            ]);

            foreach ($lines as $l) {
                $order->items()->create([
                    'itemable_type' => Product::class,
                    'itemable_id' => $l['product']->id,
                    'quantity' => $l['quantity'],
                    'unit_price' => $l['unit'],
                    'line_total' => $l['total'],
                ]);
            }

            // Tout ou rien : une exception de stock annule la commande
            $this->stock->reserve($order, null);

            return $order;
        });

        if ($paid) {
            $order = $this->fulfillment->markPaid($order);
            if (in_array($order->delivery_method, ['delivery', 'pickup'], true) && $order->fulfillment_status === null) {
                $order->update(['fulfillment_status' => FulfillmentStatus::Received]);
            }
        }

        $this->activity->log($admin, 'order.created_manually', $order, [
            'source' => $d['source'],
            'payment_method' => $d['payment_method'] ?? null,
            'paid' => $paid,
            'order_total' => $order->total,
        ]);

        return $order->fresh(['user', 'items.itemable']);
    }

    /** @return array{0: string, 1: string|null, 2: int} */
    private function delivery(array $d): array
    {
        if (($d['delivery_method'] ?? null) === 'pickup') {
            return ['pickup', null, (int) config('shipping.pickup_fee', 0)];
        }

        $errors = [];
        foreach (['delivery_zone' => 'la zone', 'city' => 'la ville', 'address' => "l'adresse"] as $f => $label) {
            if (empty($d[$f])) {
                $errors[$f] = "Indique $label de livraison.";
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $zone = (string) $d['delivery_zone'];

        return ['delivery', $zone, (int) (\App\Models\ShippingZone::query()->where('code', $zone)->value('fee') ?? 0)];
    }
}