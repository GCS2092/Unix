<?php

namespace App\Policies;

use App\Models\Order;
use App\Models\User;

class OrderPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Order $order): bool
    {
        if ($user->is_admin) {
            return true;
        }

        return $order->user_id !== null && $order->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->is_admin;
    }

    public function update(User $user, Order $order): bool
    {
        return $user->is_admin;
    }

    public function delete(User $user, Order $order): bool
    {
        return $user->is_admin;
    }

    public function manage(User $user): bool
    {
        return $user->is_admin;
    }
}
