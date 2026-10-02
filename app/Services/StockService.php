<?php

namespace App\Services;

use App\Enums\StockMovementReason;
use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockService
{
    /**
     * Réserve (décrémente) le stock de toutes les lignes produit de la commande.
     * Tout ou rien. À appeler DANS une transaction.
     *
     * @throws InsufficientStockException
     */
    public function reserve(Order $order, ?Carbon $expiresAt = null): void
    {
        $quantities = $this->productQuantities($order);

        if ($quantities === []) {
            return; // commande sans produit physique
        }

        $products = $this->lockProducts(array_keys($quantities));

        foreach ($quantities as $productId => $qty) {
            $product = $products->get($productId);

            if ($product === null || $product->stock < $qty) {
                throw new InsufficientStockException(
                    $product?->localizedName() ?? "#{$productId}",
                    (int) $productId,
                    $product === null ? 0 : (int) $product->stock,
                    $qty,
                );
            }
        }

        foreach ($quantities as $productId => $qty) {
            $this->move($products->get($productId), -$qty, StockMovementReason::Reserve, $order);
        }

        $order->forceFill([
            'stock_reserved' => true,
            'reservation_expires_at' => $expiresAt,
        ])->save();
    }

    /**
     * Remet en vente le stock réservé par la commande. Idempotent :
     * ne fait rien si la commande ne détient pas de stock.
     */
    public function release(Order $order, StockMovementReason $reason = StockMovementReason::Release): bool
    {
        if (! $order->stock_reserved) {
            return false;
        }

        $quantities = $this->productQuantities($order);
        $products = $this->lockProducts(array_keys($quantities));

        foreach ($quantities as $productId => $qty) {
            $product = $products->get($productId);
            if ($product !== null) { // produit supprimé entre-temps : on ignore
                $this->move($product, $qty, $reason, $order);
            }
        }

        $order->forceFill([
            'stock_reserved' => false,
            'reservation_expires_at' => null,
        ])->save();

        return true;
    }

    /** Variation manuelle (+ ou -). Refuse de passer sous 0. */
    public function adjust(
        Product $product,
        int $delta,
        StockMovementReason $reason,
        ?User $admin = null,
        ?string $note = null,
    ): StockMovement {
        return DB::transaction(function () use ($product, $delta, $reason, $admin, $note): StockMovement {
            $locked = Product::query()->without('images')->lockForUpdate()->findOrFail($product->id);

            if ($locked->stock + $delta < 0) {
                throw ValidationException::withMessages([
                    'quantity' => "Stock insuffisant : il reste {$locked->stock} unité(s).",
                ]);
            }

            return $this->move($locked, $delta, $reason, null, $admin, $note);
        });
    }

    /** Fixe le stock à une valeur comptée (inventaire). */
    public function setTo(
        Product $product,
        int $newStock,
        StockMovementReason $reason,
        ?User $admin = null,
        ?string $note = null,
    ): StockMovement {
        return DB::transaction(function () use ($product, $newStock, $reason, $admin, $note): StockMovement {
            $locked = Product::query()->without('images')->lockForUpdate()->findOrFail($product->id);

            return $this->move($locked, $newStock - $locked->stock, $reason, null, $admin, $note);
        });
    }

    private function move(
        Product $product,
        int $delta,
        StockMovementReason $reason,
        ?Order $order = null,
        ?User $admin = null,
        ?string $note = null,
    ): StockMovement {
        $movement = $this->moveRaw($product, $delta, $reason, $order, $admin, $note);

        // Action manuelle d'un admin : tracée aussi dans le journal d'activité.
        if ($order === null && $admin !== null) {
            app(ActivityLogger::class)->log($admin, 'stock.'.$reason->value, $product, [
                'product' => $product->name,
                'quantity_change' => $delta,
                'stock_after' => $movement->stock_after,
                'note' => $note,
            ]);
        }

        return $movement;
    }

    private function moveRaw(
        Product $product,
        int $delta,
        StockMovementReason $reason,
        ?Order $order = null,
        ?User $admin = null,
        ?string $note = null,
    ): StockMovement {
        $product->stock = $product->stock + $delta;
        $product->save();

        return StockMovement::query()->create([
            'product_id' => $product->id,
            'order_id' => $order?->id,
            'user_id' => $admin?->id,
            'quantity_change' => $delta,
            'stock_after' => $product->stock,
            'reason' => $reason,
            'note' => $note,
        ]);
    }

    /** @return array<int, int> product_id => quantité totale, triés par id (ordre de verrouillage stable) */
    private function productQuantities(Order $order): array
    {
        $types = array_unique([Product::class, (new Product)->getMorphClass()]);

        return $order->items()
            ->whereIn('itemable_type', $types)
            ->get()
            ->groupBy('itemable_id')
            ->map(fn ($lines) => (int) $lines->sum('quantity'))
            ->sortKeys()
            ->all();
    }

    /** Verrouille les produits dans l'ordre des ids pour éviter les deadlocks. */
    private function lockProducts(array $ids)
    {
        return Product::query()
            ->without('images')
            ->whereIn('id', $ids)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }
}