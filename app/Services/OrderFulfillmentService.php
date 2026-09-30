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

    public function markPaid(Order $order): Order
    {
        if ($order->isPaid()) {
            return $order;
        }

        if (! in_array($order->status, [OrderStatus::Pending, OrderStatus::Failed], true)) {
            throw new \RuntimeException(__('api.order.only_pending'));
        }

        return DB::transaction(function () use ($order): Order {
            $order->update([
                'status' => OrderStatus::Paid,
                'paid_at' => now(),
            ]);

            $order = $order->fresh(['items.itemable', 'user']);

            $this->fulfillOrder($order);

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

    private function fulfillOrder(Order $order): void
    {
        $order->loadMissing('items.itemable', 'user');

        foreach ($order->items as $item) {
            if ($item->itemable instanceof Product) {
                $item->itemable->decrement('stock', $item->quantity);
            }
        }

        $email = $order->recipientEmail();
        if ($email !== null) {
            $recipient = $order->user ?? User::query()->where('email', $email)->first();
            if ($recipient !== null) {
                $recipient->notify(new OrderPaidNotification($order));
            }
        }
    }
}