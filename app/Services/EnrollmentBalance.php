<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Enrollment;
use App\Models\EnrollmentPayment;

/** Calcule payé, solde et statut d'une inscription a partir de ses versements. */
final class EnrollmentBalance
{
    /** @return array{tracked: bool, total: int, paid: int, balance: int, status: string} */
    public static function summary(Enrollment $e): array
    {
        $total = (int) ($e->agreed_price ?? $e->course?->price ?? 0);

        if (! $e->payment_tracked) {
            return ['tracked' => false, 'total' => $total, 'paid' => $total, 'balance' => 0, 'status' => 'settled'];
        }

        $paid = (int) EnrollmentPayment::query()->where('enrollment_id', $e->id)->sum('amount');
        $balance = max(0, $total - $paid);
        $status = $paid >= $total ? 'settled' : ($paid > 0 ? 'deposit_paid' : 'pending');

        return ['tracked' => true, 'total' => $total, 'paid' => $paid, 'balance' => $balance, 'status' => $status];
    }

    /** Le cours est-il accessible ? Decision manuelle de l'admin, sinon regle de la formation. */
    public static function hasAccess(Enrollment $e): bool
    {
        $override = $e->access_override ?? null;
        if ($override === 'granted') {
            return true;
        }
        if ($override === 'blocked') {
            return false;
        }
        if (! $e->payment_tracked) {
            return true;
        }

        $status = self::summary($e)['status'];

        return match ($e->course?->access_policy ?? 'always') {
            'deposit' => $status !== 'pending',
            'settled' => $status === 'settled',
            default => true,
        };
    }

    /** Raison du blocage ('suspended' ou 'payment'), ou null si l'acces est autorise. */
    public static function blockReason(Enrollment $e): ?string
    {
        if (self::hasAccess($e)) {
            return null;
        }

        return ($e->access_override ?? null) === 'blocked' ? 'suspended' : 'payment';
    }

    /** Refus a renvoyer a un etudiant sans acces (null si autorise ou si admin). */
    public static function denial(Enrollment $e, ?\App\Models\User $user): ?array
    {
        if ($user?->is_admin) {
            return null;
        }
        $reason = self::blockReason($e);
        if ($reason === null) {
            return null;
        }
        $balance = self::summary($e)['balance'];

        return [
            'message' => $reason === 'suspended'
                ? 'Votre accès à ce cours est suspendu. Contactez l\'administration.'
                : 'Accès en attente de paiement : il reste '.number_format($balance, 0, ',', ' ').' FCFA à régler.',
            'code' => 'payment_required',
        ];
    }
    /** Echeance du solde : premier versement (ou inscription) + delai de la formation. Null si non applicable. */
    public static function dueAt(Enrollment $e): ?\Illuminate\Support\Carbon
    {
        if (! $e->payment_tracked) {
            return null;
        }
        $days = (int) ($e->course?->balance_due_days ?? 0);
        if ($days <= 0 || self::summary($e)['balance'] <= 0) {
            return null;
        }
        $first = EnrollmentPayment::query()->where('enrollment_id', $e->id)->min('paid_at');
        $anchor = $first ? \Illuminate\Support\Carbon::parse($first) : $e->created_at;

        return $anchor?->copy()->addDays($days)->endOfDay();
    }

    public static function isOverdue(Enrollment $e): bool
    {
        $due = self::dueAt($e);

        return $due !== null && now()->greaterThan($due);
    }
    /** Montant de l'acompte demande pour une formation (0 = pas d'acompte). */
    public static function depositFor(Course $c): int
    {
        $price = (int) $c->price;
        $value = (int) ($c->deposit_value ?? 0);

        return match ($c->deposit_type ?? 'none') {
            'fixed' => min($value, $price),
            'percent' => (int) round($price * min($value, 100) / 100),
            default => 0,
        };
    }
}