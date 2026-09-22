<?php

namespace App\Services;

use App\Enums\CartItemType;
use App\Models\Course;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Session;

class CartService
{
    private const SESSION_KEY = 'cart';

    /**
     * @return array<string, array{type: string, id: int, quantity: int}>
     */
    public function all(): array
    {
        return Session::get(self::SESSION_KEY, []);
    }

    public function add(string $type, int $id, int $quantity = 1): void
    {
        $type = CartItemType::from($type)->value;
        $quantity = max(1, $quantity);
        $key = $this->key($type, $id);
        $cart = $this->all();

        if (isset($cart[$key])) {
            $cart[$key]['quantity'] += $quantity;
        } else {
            $cart[$key] = [
                'type' => $type,
                'id' => $id,
                'quantity' => $quantity,
            ];
        }

        Session::put(self::SESSION_KEY, $cart);
    }

    public function update(string $type, int $id, int $quantity): void
    {
        $type = CartItemType::from($type)->value;
        $key = $this->key($type, $id);
        $cart = $this->all();

        if ($quantity <= 0) {
            unset($cart[$key]);
        } else {
            $cart[$key] = [
                'type' => $type,
                'id' => $id,
                'quantity' => $quantity,
            ];
        }

        Session::put(self::SESSION_KEY, $cart);
    }

    public function remove(string $type, int $id): void
    {
        $type = CartItemType::from($type)->value;
        $cart = $this->all();
        unset($cart[$this->key($type, $id)]);
        Session::put(self::SESSION_KEY, $cart);
    }

    public function clear(): void
    {
        Session::forget(self::SESSION_KEY);
    }

    public function isEmpty(): bool
    {
        return $this->all() === [];
    }

    public function total(): int
    {
        return (int) $this->detailedItems()->sum('line_total');
    }

    /**
     * @return Collection<int, array{type: string, id: int, quantity: int, title: string, slug: string, unit_price: int, line_total: int, model: Course|Product}>
     */
    public function detailedItems(): Collection
    {
        return collect($this->all())->map(function (array $item): array {
            $model = $this->resolveItem($item['type'], $item['id']);
            $unitPrice = (int) $model->price;
            $quantity = (int) $item['quantity'];

            return [
                'type' => $item['type'],
                'id' => $item['id'],
                'quantity' => $quantity,
                'title' => $item['type'] === CartItemType::Course->value
                    ? $model->title
                    : $model->name,
                'slug' => $model->slug,
                'unit_price' => $unitPrice,
                'line_total' => $unitPrice * $quantity,
                'model' => $model,
            ];
        })->values();
    }

    private function key(string $type, int $id): string
    {
        return $type.':'.$id;
    }

    private function resolveItem(string $type, int $id): Course|Product
    {
        return match (CartItemType::from($type)) {
            CartItemType::Course => Course::query()
                ->where('is_published', true)
                ->findOrFail($id),
            CartItemType::Product => Product::query()
                ->where('is_published', true)
                ->findOrFail($id),
        };
    }
}
