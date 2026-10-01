<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $users = User::query()
            ->withCount(['orders', 'enrollments'])
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $w->where(fn ($x) => $x->where('name', 'like', $like)->orWhere('email', 'like', $like));
            })
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $u) => $this->payload($u))->values(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    public function update(Request $request, User $user, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'is_admin' => ['sometimes', 'boolean'],
            'is_blocked' => ['sometimes', 'boolean'],
        ]);

        $actor = $request->user();

        if ($actor->is($user)) {
            return response()->json(['message' => 'Vous ne pouvez pas modifier votre propre compte.'], 422);
        }

        if (array_key_exists('is_admin', $data) && (bool) $data['is_admin'] !== (bool) $user->is_admin) {
            $user->is_admin = (bool) $data['is_admin'];
            $user->save();
            $activity->log($actor, $user->is_admin ? 'user.promoted_admin' : 'user.demoted_admin', $user, ['email' => $user->email]);
        }

        if (array_key_exists('is_blocked', $data) && (bool) $data['is_blocked'] !== (bool) $user->is_blocked) {
            if ($data['is_blocked'] && $user->is_admin) {
                return response()->json(['message' => 'Retirez d\'abord le rôle administrateur avant de bloquer ce compte.'], 422);
            }

            $user->is_blocked = (bool) $data['is_blocked'];
            $user->save();

            if ($user->is_blocked) {
                $user->tokens()->delete();
            }

            $activity->log($actor, $user->is_blocked ? 'user.blocked' : 'user.unblocked', $user, ['email' => $user->email]);
        }

        $user->loadCount(['orders', 'enrollments']);

        return response()->json(['data' => $this->payload($user)]);
    }

    /** @return array<string, mixed> */
    private function payload(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'is_admin' => (bool) $u->is_admin,
            'is_blocked' => (bool) $u->is_blocked,
            'created_at' => $u->created_at?->toIso8601String(),
            'orders_count' => (int) ($u->orders_count ?? 0),
            'enrollments_count' => (int) ($u->enrollments_count ?? 0),
        ];
    }
}