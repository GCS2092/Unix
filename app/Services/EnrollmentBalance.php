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