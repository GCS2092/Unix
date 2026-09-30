<?php

namespace App\Services;

use App\Enums\CartItemType;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Session;

class CartService
{
    private const SESSION_KEY = 'cart';

    /**
     * Seuls les produits sont conserves : d'anciennes entrees "course"
     * presentes dans une session existante sont ignorees.
     *
     * @return array<string, array{type: string, id: int, quantity: int}>
     */
    public function all(): array
    {
        return collect(Session::get(self::SESSION_KEY, []))
            ->filter(fn ($item) => is_array($item) && ($item['type'] ?? null) === CartItemType::Product->value)
            ->all();
    }

    public function add(string $type, int $id, int $quantity = 1, ?User $user = null): void
    {
        if ($type !== CartItemType::Product->value || $this->resolveItem($id) === null) {
            throw new \RuntimeException(__('api.cart.item_unavailable'));
        }

        $quantity = max(1, $quantity);
        $key = $this->key($id);
        $cart = $this->all();

        if (isset($cart[$key])) {
            $cart[$key]['quantity'] += $quantity;
        } else {
            $cart[$key] = ['type' => CartItemType::Product->value, 'id' => $id, 'quantity' => $quantity];
        }

        Session::put(self::SESSION_KEY, $cart);
    }

    public function update(string $type, int $id, int $quantity): void
    {
        if ($type !== CartItemType::Product->value) {
            return;
        }

        $key = $this->key($id);
        $cart = $this->all();

        if ($quantity <= 0) {
            unset($cart[$key]);
        } else {
            $cart[$key] = ['type' => CartItemType::Product->value, 'id' => $id, 'quantity' => $quantity];
        }

        Session::put(self::SESSION_KEY, $cart);
    }

    public function remove(string $type, int $id): void
    {
        $cart = $this->all();
        unset($cart[$this->key($id)]);
        Session::put(self::SESSION_KEY, $cart);
    }

    public function clear(): void
    {
        Session::forget(self::SESSION_KEY);
    }

    public function isEmpty(): bool
    {
        return $this->detailedItems()->isEmpty();
    }

    public function total(): int
    {
        return (int) $this->detailedItems()->sum('line_total');
    }

    /**
     * Les produits depublies ou supprimes depuis leur ajout sont ignores
     * et retires de la session (au lieu de faire echouer tout le panier).
     *
     * @return Collection<int, array{type: string, id: int, quantity: int, title: string, slug: string, unit_price: int, line_total: int, model: Product}>
     */
    public function detailedItems(): Collection
    {
        $cart = $this->all();
        $stale = [];

        $items = collect($cart)->map(function (array $item, string $key) use (&$stale): ?array {
            $model = $this->resolveItem((int) $item['id']);

            if ($model === null) {
                $stale[] = $key;

                return null;
            }

            $unitPrice = (int) $model->price;
            $quantity = (int) $item['quantity'];

            return [
                'type' => CartItemType::Product->value,
                'id' => $item['id'],
                'quantity' => $quantity,
                'title' => $model->localizedName(),
                'slug' => $model->slug,
                'unit_price' => $unitPrice,
                'line_total' => $unitPrice * $quantity,
                'model' => $model,
            ];
        })->filter()->values();

        // Reecrit la session : retire aussi les anciennes formations et les produits disparus
        Session::put(self::SESSION_KEY, array_diff_key($cart, array_flip($stale)));

        return $items;
    }

    private function key(int $id): string
    {
        return CartItemType::Product->value.':'.$id;
    }

    private function resolveItem(int $id): ?Product
    {
        return Product::query()->where('is_published', true)->find($id);
    }
}