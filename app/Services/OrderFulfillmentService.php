<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderFulfillmentService
{
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

        foreach ($items as $item) {
            if ($item['model'] instanceof Product && ! $item['model']->isInStock($item['quantity'])) {
                throw new \RuntimeException(__('api.order.insufficient_stock', ['name' => $item['model']->localizedName()]));
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

            $cart->clear();

            return $order->load('items.itemable');
        });
    }

    /**
     * Marque la commande payee : la base est mise a jour dans une transaction,
     * puis l'e-mail est envoye APRES le commit. Un probleme d'envoi (SMTP, PDF)
     * ne peut donc plus annuler un paiement valide.
     */
    public function markPaid(Order $order): Order
    {
        if ($order->isPaid()) {
            return $order;
        }

        if (! in_array($order->status, [OrderStatus::Pending, OrderStatus::Failed], true)) {
            throw new \RuntimeException(__('api.order.only_pending'));
        }

        $paid = DB::transaction(function () use ($order): Order {
            $order->update([
                'status' => OrderStatus::Paid,
                'paid_at' => now(),
            ]);

            $order = $order->fresh(['items.itemable', 'user']);

            $this->decrementStock($order);

            return $order;
        });

        $this->notifyPaid($paid);

        return $paid->fresh(['items.itemable', 'user']);
    }

    /**
     * Annule une commande. Si elle etait payee, le stock est remis.
     * Le remboursement du client reste une operation manuelle chez le prestataire de paiement.
     */
    public function cancel(Order $order): Order
    {
        if ($order->status === OrderStatus::Cancelled) {
            return $order;
        }

        if (! in_array($order->status, [OrderStatus::Pending, OrderStatus::Failed, OrderStatus::Paid], true)) {
            throw new \RuntimeException('Cette commande ne peut pas être annulée.');
        }

        $wasPaid = $order->isPaid();

        return DB::transaction(function () use ($order, $wasPaid): Order {
            $order->loadMissing('items.itemable');

            if ($wasPaid) {
                $this->restoreStock($order);
            }

            $order->update([
                'status' => OrderStatus::Cancelled,
                'fulfillment_status' => null,
            ]);

            return $order->fresh(['items.itemable', 'user']);
        });
    }

    public function markFailed(Order $order): Order
    {
        if ($order->isPaid()) {
            return $order;
        }

        $order->update(['status' => OrderStatus::Failed]);

        return $order->fresh();
    }

    public function attachGuestOrdersToUser(User $user): void
    {
        Order::query()
            ->whereNull('user_id')
            ->where('guest_email', $user->email)
            ->update(['user_id' => $user->id]);
    }

    /** Decremente le stock sans jamais passer sous 0 (requete atomique). */
    private function decrementStock(Order $order): void
    {
        foreach ($order->items as $item) {
            if ($item->itemable instanceof Product) {
                $q = max(0, (int) $item->quantity);
                Product::query()->whereKey($item->itemable->id)->update([
                    'stock' => DB::raw("CASE WHEN stock >= {$q} THEN stock - {$q} ELSE 0 END"),
                ]);
            }
        }
    }

    private function restoreStock(Order $order): void
    {
        foreach ($order->items as $item) {
            if ($item->itemable instanceof Product) {
                $item->itemable->increment('stock', (int) $item->quantity);
            }
        }
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
                \Illuminate\Support\Facades\Notification::route('mail', $email)->notify(new OrderPaidNotification($order));
            }
        } catch (\Throwable $e) {
            report($e); // l'e-mail est secondaire : le paiement reste valide
        }
    }
}