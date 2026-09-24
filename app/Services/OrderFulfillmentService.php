<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Notifications\OrderPaidNotification;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
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
            throw new \RuntimeException('Un email invite est requis pour commander sans compte.');
        }

        $items = $cart->detailedItems();

        foreach ($items as $item) {
            if ($item['model'] instanceof Product && ! $item['model']->isInStock($item['quantity'])) {
                throw new \RuntimeException('Stock insuffisant pour « '.$item['model']->name.' ».');
            }

            if ($item['model'] instanceof Course && $user !== null) {
                $alreadyEnrolled = Enrollment::query()
                    ->where('user_id', $user->id)
                    ->where('course_id', $item['model']->id)
                    ->exists();

                if ($alreadyEnrolled) {
                    throw new \RuntimeException('Vous etes deja inscrit au cours « '.$item['model']->title.' ».');
                }
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
            throw new \RuntimeException('Seules les commandes en attente peuvent etre marquees payees.');
        }

        return DB::transaction(function () use ($order): Order {
            $order->update([
                'status' => OrderStatus::Paid,
                'paid_at' => now(),
            ]);

            $order = $this->provisionGuestAccountIfNeeded($order->fresh(['items.itemable', 'user']));

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

        $paidOrders = Order::query()
            ->where('user_id', $user->id)
            ->where('status', OrderStatus::Paid)
            ->with('items.itemable')
            ->get();

        foreach ($paidOrders as $order) {
            $this->fulfillEnrollmentsOnly($order);
        }
    }

    /**
     * Si une commande payee contient un cours et qu'elle n'a pas de compte
     * associe (achat invite), on cree automatiquement un compte utilisateur
     * pour permettre l'acces immediat au cours, puis on envoie un email
     * pour que l'invite definisse son mot de passe. Aucune action n'est
     * requise de sa part au moment de l'achat.
     */
    private function provisionGuestAccountIfNeeded(Order $order): Order
    {
        if ($order->user_id !== null) {
            return $order;
        }

        $hasCourse = $order->items->contains(fn ($item) => $item->itemable instanceof Course);

        if (! $hasCourse) {
            return $order;
        }

        $email = $order->guest_email;

        if ($email === null) {
            return $order;
        }

        $user = User::query()->where('email', $email)->first();
        $isNewAccount = $user === null;

        if ($isNewAccount) {
            $user = User::query()->create([
                'name' => $order->guest_name ?? 'Client',
                'email' => $email,
                'password' => Hash::make(Str::random(40)),
            ]);
        }

        $order->update(['user_id' => $user->id]);
        $this->attachGuestOrdersToUser($user);

        if ($isNewAccount) {
            $token = Password::broker()->createToken($user);
            $user->notify(new ResetPassword($token));
        }

        return $order->fresh(['items.itemable', 'user']);
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
