<?php

namespace App\Services;

use App\Enums\CartItemType;
use App\Exceptions\InsufficientStockException;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
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
        $product = $type === CartItemType::Product->value ? $this->resolveItem($id) : null;

        if ($product === null) {
            throw new \RuntimeException(__('api.cart.item_unavailable'));
        }

        $quantity = max(1, $quantity);
        $key = $this->key($id);
        $cart = $this->all();

        // Jamais plus que le stock disponible (quantite deja au panier incluse).
        $wanted = ($cart[$key]['quantity'] ?? 0) + $quantity;
        if ($wanted > $product->availableStock()) {
            throw new InsufficientStockException(
                $product->localizedName(),
                (int) $product->id,
                max(0, $product->availableStock()),
                $wanted,
            );
        }

        // Cumul reel : un pack et ses composants vendus seuls puisent dans le meme stock.
        $next = $cart;
        $next[$key] = ['type' => CartItemType::Product->value, 'id' => $id, 'quantity' => $wanted];
        $this->assertCartFits($next);

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
            $product = $this->resolveItem($id);
            if ($product === null) {
                throw new \RuntimeException(__('api.cart.item_unavailable'));
            }
            if ($quantity > $product->availableStock()) {
                throw new InsufficientStockException(
                    $product->localizedName(),
                    (int) $product->id,
                    max(0, $product->availableStock()),
                    $quantity,
                );
            }

            $next = $cart;
            $next[$key] = ['type' => CartItemType::Product->value, 'id' => $id, 'quantity' => $quantity];
            $this->assertCartFits($next);

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
     * Une seule requete SQL pour tout le panier (avant : une requete par ligne
     * et a chaque lecture), et la session n'est reecrite que si elle a change.
     *
     * @return Collection<int, array{type: string, id: int, quantity: int, title: string, slug: string, unit_price: int, line_total: int, model: Product}>
     */
    public function detailedItems(): Collection
    {
        $cart = $this->all();

        $ids = collect($cart)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $products = $ids === []
            ? collect()
            : Product::query()->where('is_published', true)->whereIn('id', $ids)->get()->keyBy('id');

        $stale = [];

        $items = collect($cart)->map(function (array $item, string $key) use ($products, &$stale): ?array {
            $model = $products->get((int) $item['id']);

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

        // Retire de la session les produits disparus et les anciennes formations,
        // mais seulement si le contenu a vraiment change.
        $clean = array_diff_key($cart, array_flip($stale));
        if (count($clean) !== count((array) Session::get(self::SESSION_KEY, []))) {
            Session::put(self::SESSION_KEY, $clean);
        }

        return $items;
    }

    /**
     * Le panier doit tenir dans le stock REEL : un pack et ses composants vendus
     * separement puisent dans le meme stock (ex. pack + mallette seule).
     *
     * @param  array<string, array{type: string, id: int, quantity: int}>  $cart
     */
    private function assertCartFits(array $cart): void
    {
        $ids = collect($cart)->pluck('id')->map(fn ($i) => (int) $i)->unique()->values()->all();
        if ($ids === []) {
            return;
        }

        $products = Product::query()->without(['images', 'category'])->whereIn('id', $ids)->get(['id', 'kind'])->keyBy('id');
        $parts = DB::table('product_bundle_items')->whereIn('bundle_id', $ids)->get()->groupBy('bundle_id');

        $need = [];
        foreach ($cart as $line) {
            $id = (int) $line['id'];
            $qty = (int) $line['quantity'];
            $p = $products->get($id);
            if ($p === null) {
                continue;
            }
            if ($p->kind === 'bundle') {
                foreach ($parts->get($id, collect()) as $c) {
                    $cid = (int) $c->component_id;
                    $need[$cid] = ($need[$cid] ?? 0) + $qty * (int) $c->quantity;
                }
            } else {
                $need[$id] = ($need[$id] ?? 0) + $qty;
            }
        }
        if ($need === []) {
            return;
        }

        $stocks = Product::query()->without(['images', 'category'])->whereIn('id', array_keys($need))
            ->get(['id', 'name', 'name_en', 'stock'])->keyBy('id');

        foreach ($need as $cid => $qty) {
            $c = $stocks->get($cid);
            $have = $c === null ? 0 : max(0, (int) $c->stock);
            if ($qty > $have) {
                throw new InsufficientStockException($c?->localizedName() ?? "#{$cid}", (int) $cid, $have, $qty);
            }
        }
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