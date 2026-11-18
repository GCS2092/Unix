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
            'is_student' => ['sometimes', 'boolean'],
            'admin_scope' => ['required_if:is_admin,true', 'nullable', 'in:super,shop,formation,instructor'],
        ]);

        $actor = $request->user();

        if ($actor->is($user)) {
            return response()->json(['message' => 'Vous ne pouvez pas modifier votre propre compte.'], 422);
        }

        if (array_key_exists('is_admin', $data) && (bool) $data['is_admin'] !== (bool) $user->is_admin) {
            $user->is_admin = (bool) $data['is_admin'];
            $user->admin_scope = $user->is_admin ? ($data['admin_scope'] ?? null) : null;
            $user->save();
            $activity->log($actor, $user->is_admin ? 'user.promoted_admin' : 'user.demoted_admin', $user, ['email' => $user->email]);
        }

        if (array_key_exists('admin_scope', $data) && ! array_key_exists('is_admin', $data)
            && $user->is_admin && $data['admin_scope'] && $data['admin_scope'] !== $user->admin_scope) {
            $user->admin_scope = $data['admin_scope'];
            $user->save();
            $activity->log($actor, 'user.scope_changed', $user, ['email' => $user->email, 'scope' => $user->admin_scope]);
        }

        if (array_key_exists('is_student', $data) && (bool) $data['is_student'] !== (bool) $user->is_student) {
            $user->is_student = (bool) $data['is_student'];
            $user->save();
            $activity->log($actor, $user->is_student ? 'user.student_enabled' : 'user.student_disabled', $user, ['email' => $user->email]);
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

    /** Suppression : definitive si le compte est vide, sinon anonymisation (commandes et certificats conserves). */
    public function destroy(Request $request, User $user, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate(['confirm_email' => ['required', 'string']]);
        $actor = $request->user();

        if ($actor->is($user)) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }
        if ($user->is_admin) {
            return response()->json(['message' => 'Retirez d\'abord le rôle administrateur avant de supprimer ce compte.'], 422);
        }
        if (strcasecmp(trim($data['confirm_email']), (string) $user->email) !== 0) {
            return response()->json(['message' => 'L\'adresse e-mail saisie ne correspond pas.'], 422);
        }

        $id = $user->id;
        $email = $user->email;
        $hasData = $user->orders()->exists()
            || $user->enrollments()->exists()
            || \App\Models\EnrollmentRequest::query()->where('user_id', $id)->exists();

        \Illuminate\Support\Facades\DB::transaction(function () use ($user, $id, $hasData): void {
            $user->tokens()->delete();

            if (! $hasData) {
                $user->forceDelete();

                return;
            }

            \Illuminate\Support\Facades\DB::table('addresses')->where('user_id', $id)->delete();
            \Illuminate\Support\Facades\DB::table('email_verification_codes')->where('user_id', $id)->delete();

            $user->forceFill([
                'name' => 'Utilisateur supprimé',
                'email' => 'deleted-'.$id.'@invalid.local',
                'password' => \Illuminate\Support\Str::random(64),
                'remember_token' => null,
                'email_verified_at' => null,
                'phone' => null,
                'gender' => null,
                'birth_date' => null,
                'birth_place' => null,
                'birth_country' => null,
                'nationality' => null,
                'country' => null,
                'city' => null,
                'address' => null,
                'profession' => null,
                'is_blocked' => true,
                'is_student' => false,
                'anonymized_at' => now(),
            ])->save();
            $user->delete();
        });

        $activity->log($actor, $hasData ? 'user.anonymized' : 'user.deleted', $user, ['email' => $email]);

        return response()->json(['data' => ['deleted' => true, 'mode' => $hasData ? 'anonymized' : 'removed']]);
    }

    /** @return array<string, mixed> */
    private function payload(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'is_admin' => (bool) $u->is_admin,
            'admin_scope' => $u->admin_scope ?: null,
            'is_blocked' => (bool) $u->is_blocked,
            'is_student' => (bool) $u->is_student,
            'created_at' => $u->created_at?->toIso8601String(),
            'orders_count' => (int) ($u->orders_count ?? 0),
            'enrollments_count' => (int) ($u->enrollments_count ?? 0),
            'phone' => $u->phone,
            'email_verified' => $u->email_verified_at !== null,
            'gender' => $u->gender,
            'birth_date' => $u->birth_date ? substr((string) $u->birth_date, 0, 10) : null,
            'birth_place' => $u->birth_place,
            'birth_country' => $u->birth_country,
            'nationality' => $u->nationality,
            'country' => $u->country,
            'city' => $u->city,
            'address' => $u->address,
            'profession' => $u->profession,
        ];
    }
}


