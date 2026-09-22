<?php

namespace App\Services;

use App\Http\Resources\CartResource;
use App\Models\Order;
use App\Models\User;

class CheckoutService
{
    public function __construct(
        private readonly CartService $cart,
        private readonly OrderFulfillmentService $fulfillment,
    ) {}

    /**
     * @return array{items: \Illuminate\Support\Collection, total: int}
     */
    public function preview(): array
    {
        if ($this->cart->isEmpty()) {
            throw new \RuntimeException('Le panier est vide.');
        }

        return [
            'items' => $this->cart->detailedItems(),
            'total' => $this->cart->total(),
        ];
    }

    public function createOrder(
        ?User $user,
        ?string $guestEmail,
        ?string $guestName,
    ): Order {
        return $this->fulfillment->createOrderFromCart(
            $this->cart,
            $user,
            $guestEmail,
            $guestName,
        );
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
