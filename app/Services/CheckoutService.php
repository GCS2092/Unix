<?php

namespace App\Services;

use App\Http\Resources\CartResource;
use App\Models\Order;
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
        if ($this->cart->isEmpty()) {
            throw new \RuntimeException(__('checkout.cart_empty'));
        }

        return [
            'items' => $this->cart->detailedItems(),
            'total' => $this->cart->total(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data  Donnees validees par CheckoutRequest
     */
    public function createOrder(?User $user, array $data): Order
    {
        if ($this->cart->isEmpty()) {
            throw new \RuntimeException(__('checkout.cart_empty'));
        }

        [$method, $zone, $fee] = $this->resolveDelivery($data);

        $order = $this->fulfillment->createOrderFromCart(
            $this->cart,
            $user,
            $data['guest_email'] ?? null,
            $data['guest_name'] ?? null,
        );

        // Les frais sont toujours calcules ici, jamais lus depuis le navigateur
        $subtotal = (int) $order->total;

        $order->update([
            'phone' => $data['phone'] ?? null,
            'delivery_method' => $method,
            'delivery_zone' => $zone,
            'city' => $method === 'delivery' ? ($data['city'] ?? null) : null,
            'district' => $method === 'delivery' ? ($data['district'] ?? null) : null,
            'address' => $method === 'delivery' ? ($data['address'] ?? null) : null,
            'landmark' => $method === 'delivery' ? ($data['landmark'] ?? null) : null,
            'note' => $data['note'] ?? null,
            'subtotal' => $subtotal,
            'delivery_fee' => $fee,
            'total' => $subtotal + $fee,
        ]);

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

        $zone = (string) $data['delivery_zone'];

        return ['delivery', $zone, (int) config("shipping.zones.{$zone}.fee")];
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