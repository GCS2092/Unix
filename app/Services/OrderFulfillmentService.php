<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\Course;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderFulfillmentService
{
    public function __construct(
        private readonly EnrollmentService $enrollments,
    ) {}

    public function createOrderFromCart(
        CartService $cart,
        ?User $user,
        ?string $guestEmail,
        ?string $guestName,
    ): Order {
        if ($cart->isEmpty()) {
            throw new \RuntimeException('Le panier est vide.');
        }

        if ($user === null && ($guestEmail === null || $guestEmail === '')) {
            throw new \RuntimeException('Un email invité est requis pour commander sans compte.');
        }

        $items = $cart->detailedItems();

        foreach ($items as $item) {
            if ($item['model'] instanceof Product && ! $item['model']->isInStock($item['quantity'])) {
                throw new \RuntimeException('Stock insuffisant pour « '.$item['model']->name.' ».');
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

        if (! $order->status->isPending()) {
            throw new \RuntimeException('Seules les commandes en attente peuvent être marquées payées.');
        }

        return DB::transaction(function () use ($order): Order {
            $order->update([
                'status' => OrderStatus::Paid,
                'paid_at' => now(),
            ]);

            $this->fulfillOrder($order->fresh(['items.itemable', 'user']));

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

        $paidOrders = Order::query()
            ->where('user_id', $user->id)
            ->where('status', OrderStatus::Paid)
            ->with('items.itemable')
            ->get();

        foreach ($paidOrders as $order) {
            $this->fulfillEnrollmentsOnly($order);
        }
    }

    private function fulfillOrder(Order $order): void
    {
        $order->loadMissing('items.itemable', 'user');

        foreach ($order->items as $item) {
            if ($item->itemable instanceof Course && $order->user_id !== null) {
                $this->enrollments->grantEnrollment($order->user_id, $item->itemable->id);
            }

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

    private function fulfillEnrollmentsOnly(Order $order): void
    {
        $order->loadMissing('items.itemable');

        foreach ($order->items as $item) {
            if ($item->itemable instanceof Course && $order->user_id !== null) {
                $this->enrollments->grantEnrollment($order->user_id, $item->itemable->id);
            }
        }
    }
}
