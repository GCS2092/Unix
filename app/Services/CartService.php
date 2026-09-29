<?php

namespace App\Services;

use App\Enums\CartItemType;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Product;
use App\Models\User;
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

    public function add(string $type, int $id, int $quantity = 1, ?User $user = null): void
    {
        $type = CartItemType::from($type)->value;
        $quantity = max(1, $quantity);

        if ($this->resolveItem($type, $id) === null) {
            throw new \RuntimeException(__('api.cart.item_unavailable'));
        }

        if ($type === CartItemType::Course->value) {
            $quantity = 1;
            $this->guardCoursePurchase($id, $user);
        }

        $key = $this->key($type, $id);
        $cart = $this->all();

        if (isset($cart[$key])) {
            $cart[$key]['quantity'] = $type === CartItemType::Course->value
                ? 1
                : $cart[$key]['quantity'] + $quantity;
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
                'quantity' => $type === CartItemType::Course->value ? 1 : $quantity,
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
        return $this->detailedItems()->isEmpty();
    }

    public function total(): int
    {
        return (int) $this->detailedItems()->sum('line_total');
    }

    /**
     * Les articles dépubliés ou supprimés depuis leur ajout sont ignorés
     * et retirés de la session (au lieu de faire échouer tout le panier).
     *
     * @return Collection<int, array{type: string, id: int, quantity: int, title: string, slug: string, unit_price: int, line_total: int,model: Course|Product}>
     */
    public function detailedItems(): Collection
    {
        $cart = $this->all();
        $stale = [];

        $items = collect($cart)->map(function (array $item, string $key) use (&$stale): ?array {
            $model = $this->resolveItem($item['type'], (int) $item['id']);

            if ($model === null) {
                $stale[] = $key;

                return null;
            }

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
        })->filter()->values();

        if ($stale !== []) {
            Session::put(self::SESSION_KEY, array_diff_key($cart, array_flip($stale)));
        }

        return $items;
    }

    private function guardCoursePurchase(int $courseId, ?User $user): void
    {
        // Les invites peuvent acheter un cours (parcours guest checkout classique).
        // L'inscription sera rattachee au compte via attachGuestOrdersToUser()
        // au moment ou l'invite cree un compte avec le meme email.
        if ($user === null) {
            return;
        }

        $alreadyEnrolled = Enrollment::query()
            ->where('user_id', $user->id)
            ->where('course_id', $courseId)
            ->exists();

        if ($alreadyEnrolled) {
            throw new \RuntimeException(__('api.cart.already_enrolled'));
        }
    }

    private function key(string $type, int $id): string
    {
        return $type.':'.$id;
    }

    private function resolveItem(string $type, int $id): Course|Product|null
    {
        return match (CartItemType::from($type)) {
            CartItemType::Course => Course::query()
                ->where('is_published', true)
                ->find($id),
            CartItemType::Product => Product::query()
                ->where('is_published', true)
                ->find($id),
        };
    }
}