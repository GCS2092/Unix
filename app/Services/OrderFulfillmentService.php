<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\StockMovementReason;
use App\Exceptions\InsufficientStockException;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class OrderFulfillmentService
{
    public function __construct(private readonly StockService $stock)
    {
    }

    public function createOrderFromCart(
        CartService $cart,
        ?User $user,
        ?string $guestEmail,
        ?string $guestName,
    ): Order {
        if ($cart->isEmpty()) {
            throw new \RuntimeException(__('checkout.cart_empty'));
        }

        if ($user === null && ($guestEmail === null || $guestEmail === '')) {
            throw new \RuntimeException(__('api.order.guest_email_required'));
        }

        $items = $cart->detailedItems();

        // Vérification rapide (message immédiat). La vraie garantie
        // est la réservation verrouillée dans la transaction ci-dessous.
        foreach ($items as $item) {
            if ($item['model'] instanceof Product && ! $item['model']->isInStock($item['quantity'])) {
                throw new InsufficientStockException($item['model']->localizedName());
            }
        }

        return DB::transaction(function () use ($cart, $user, $guestEmail, $guestName, $items): Order {
            $order = Order::query()->create([
                'user_id' => $user?->id,
                'guest_email' => $guestEmail,
                'guest_name' => $guestName,
                'status' => OrderStatus::Pending,
                'total' => $items->sum('line_total'),
                'currency' => 'XOF',
                'payment_transaction_id' => 'ORD-'.Str::uuid()->toString(),
            ]);

            foreach ($items as $item) {
                $order->items()->create([
                    'itemable_type' => $item['model']::class,
                    'itemable_id' => $item['model']->id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                ]);
            }

            // Réservation sous verrou : si un autre client a pris le dernier
            // article entre-temps, l'exception annule toute la transaction.
            $this->stock->reserve($order, now()->addMinutes((int) config('shop.reservation_minutes', 30)));

            $cart->clear();

            return $order->load('items.itemable');
        });
    }

    /**
     * Marque la commande payée. Le stock est normalement déjà réservé ;
     * s'il a été libéré (expiration), on tente de le re-réserver. S'il manque,
     * la commande reste payée (le client a payé) mais est signalée via stock_conflict.
     * L'e-mail part APRES le commit.
     */
    public function markPaid(Order $order): Order
    {
        if ($order->isPaid()) {
            return $order;
        }

        [$locked, $justPaid] = DB::transaction(function () use ($order): array {
            $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->isPaid()) {
                return [$locked, false]; // webhook rejoué
            }

            if (! in_array($locked->status, [OrderStatus::Pending, OrderStatus::Failed], true)) {
                throw new \RuntimeException(__('api.order.only_pending'));
            }

            $conflict = false;

            if (! $locked->stock_reserved) {
                try {
                    $this->stock->reserve($locked);
                } catch (InsufficientStockException) {
                    $conflict = true;
                }
            }

            $locked->update([
                'status' => OrderStatus::Paid,
                'paid_at' => now(),
                'reservation_expires_at' => null,
                'stock_conflict' => $conflict,
            ]);

            return [$locked, true];
        });

        $paid = $locked->fresh(['items.itemable', 'user']);

        if ($justPaid) {
            if ($paid->stock_conflict) {
                Log::warning('Paiement reçu mais stock insuffisant : remboursement ou traitement manuel requis.', [
                    'order_id' => $paid->id,
                ]);
            }

            $this->notifyPaid($paid);
        }

        return $paid;
    }

    /**
     * Annule une commande et remet le stock en vente s'il était détenu
     * (commande en attente OU payée). Le remboursement reste manuel.
     */
    public function cancel(Order $order): Order
    {
        return DB::transaction(function () use ($order): Order {
            $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->status === OrderStatus::Cancelled) {
                return $locked;
            }

            if (! in_array($locked->status, [OrderStatus::Pending, OrderStatus::Failed, OrderStatus::Paid], true)) {
                throw new \RuntimeException('Cette commande ne peut pas être annulée.');
            }

            $this->stock->release($locked, StockMovementReason::Cancel);

            $locked->update([
                'status' => OrderStatus::Cancelled,
                'reservation_expires_at' => null,
                'stock_conflict' => false,
            ]);

            return $locked->fresh(['items.itemable', 'user']);
        });
    }

    public function markFailed(Order $order): Order
    {
        return DB::transaction(function () use ($order): Order {
            $locked = Order::query()->whereKey($order->getKey())->lockForUpdate()->firstOrFail();

            if ($locked->isPaid() || $locked->status === OrderStatus::Cancelled) {
                return $locked;
            }

            $this->stock->release($locked, StockMovementReason::Release);
            $locked->update(['status' => OrderStatus::Failed]);

            return $locked->fresh();
        });
    }

    /**
     * Libère les commandes en attente dont la réservation a expiré.
     * Retourne le nombre de commandes libérées.
     */
    public function releaseExpired(): int
    {
        $released = 0;

        $ids = Order::query()
            ->where('status', OrderStatus::Pending->value)
            ->where('stock_reserved', true)
            ->whereNotNull('reservation_expires_at')
            ->where('reservation_expires_at', '<=', now())
            ->pluck('id');

        foreach ($ids as $id) {
            $done = DB::transaction(function () use ($id): bool {
                $order = Order::query()->whereKey($id)->lockForUpdate()->first();

                // Re-vérification sous verrou : un paiement a pu arriver entre-temps.
                if (
                    $order === null
                    || $order->status !== OrderStatus::Pending
                    || ! $order->stock_reserved
                    || $order->reservation_expires_at === null
                    || $order->reservation_expires_at->isFuture()
                ) {
                    return false;
                }

                $this->stock->release($order, StockMovementReason::Expire);
                $order->update(['status' => OrderStatus::Failed]);

                return true;
            });

            if ($done) {
                $released++;
            }
        }

        return $released;
    }

    public function attachGuestOrdersToUser(User $user): void
    {
        Order::query()
            ->whereNull('user_id')
            ->where('guest_email', $user->email)
            ->update(['user_id' => $user->id]);
    }

    private function notifyPaid(Order $order): void
    {
        try {
            $email = $order->recipientEmail();
            if ($email === null) {
                return;
            }

            $recipient = $order->user ?? User::query()->where('email', $email)->first();
            if ($recipient) {
                $recipient->notify(new OrderPaidNotification($order));
            } else {
                Notification::route('mail', $email)->notify(new OrderPaidNotification($order));
            }
        } catch (\Throwable $e) {
            report($e); // l'e-mail est secondaire : le paiement reste valide
        }
    }
}