<?php

namespace App\Services;

use App\Http\Resources\CartResource;
use App\Models\Order;
use App\Models\ShippingZone;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CheckoutService
{
    public function __construct(
        private readonly CartService $cart,
        private readonly OrderFulfillmentService $fulfillment,
    ) {}

    /**
     * @return array{items: Collection, total: int}
     */
    public function preview(): array
    {
        $items = $this->cart->detailedItems();

        if ($items->isEmpty()) {
            throw new \RuntimeException(__('checkout.cart_empty'));
        }

        return [
            'items' => $items,
            'total' => (int) $items->sum('line_total'),
        ];
    }

    /**
     * La commande, ses lignes, la reservation de stock ET les frais de livraison
     * sont ecrits dans UNE SEULE transaction (voir OrderFulfillmentService::createOrderFromCart).
     * Avant, la commande etait d'abord creee sans frais puis mise a jour : un plantage entre
     * les deux laissait une commande reservee avec un mauvais total.
     *
     * @param  array<string, mixed>  $data  Donnees validees par CheckoutRequest
     */
    public function createOrder(?User $user, array $data): Order
    {
        $preview = $this->preview(); // leve l'exception "panier vide" si besoin

        $min = (int) config('shop.min_order', 0);
        if ($min > 0 && $preview['total'] < $min) {
            throw ValidationException::withMessages([
                'cart' => __('checkout.min_order', ['amount' => number_format($min, 0, ',', ' ')]),
            ]);
        }

        [$method, $zone, $fee] = $this->resolveDelivery($data);
        $freeAt = (int) config('shop.free_shipping_threshold', 0);

        $order = $this->fulfillment->createOrderFromCart(
            $this->cart,
            $user,
            $data['guest_email'] ?? null,
            $data['guest_name'] ?? null,
            function (int $subtotal) use ($data, $method, $zone, $fee, $freeAt): array {
                // Les frais sont toujours calcules ici, jamais lus depuis le navigateur
                $isDelivery = $method === 'delivery';
                $deliveryFee = ($isDelivery && $freeAt > 0 && $subtotal >= $freeAt) ? 0 : $fee;

                return [
                    'locale' => $data['locale'] ?? app()->getLocale(),
                    'phone' => $data['phone'] ?? null,
                    'country' => $data['country'] ?? 'SN',
                    'delivery_method' => $method,
                    'delivery_zone' => $zone,
                    'city' => $isDelivery ? ($data['city'] ?? null) : null,
                    'district' => $isDelivery ? ($data['district'] ?? null) : null,
                    'address' => $isDelivery ? ($data['address'] ?? null) : null,
                    'landmark' => $isDelivery ? ($data['landmark'] ?? null) : null,
                    'note' => $data['note'] ?? null,
                    'subtotal' => $subtotal,
                    'delivery_fee' => $deliveryFee,
                    'total' => $subtotal + $deliveryFee,
                ];
            },
        );

        return $order->refresh();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: string, 1: string|null, 2: int}
     */
    private function resolveDelivery(array $data): array
    {
        $method = $data['delivery_method'] ?? null;

        if ($method === null) {
            throw ValidationException::withMessages([
                'delivery_method' => __('checkout.choose_method'),
            ]);
        }

        if ($method === 'pickup') {
            return ['pickup', null, (int) config('shipping.pickup_fee', 0)];
        }

        $errors = [];
        foreach (['delivery_zone', 'city', 'address'] as $field) {
            if (empty($data[$field])) {
                $errors[$field] = __("checkout.missing_{$field}");
            }
        }
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $zone = ShippingZone::query()->active()->where('code', (string) $data['delivery_zone'])->where('country', $data['country'] ?? 'SN')->first();

        if ($zone === null) {
            throw ValidationException::withMessages([
                'delivery_zone' => __('checkout.missing_delivery_zone'),
            ]);
        }

        return ['delivery', $zone->code, (int) $zone->fee];
    }

    public function previewResource(): CartResource
    {
        $preview = $this->preview();

        return CartResource::make([
            'items' => $preview['items'],
            'total' => $preview['total'],
        ]);
    }
}
