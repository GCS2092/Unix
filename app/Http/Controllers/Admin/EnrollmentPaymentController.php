<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\EnrollmentPayment;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\EnrollmentBalance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnrollmentPaymentController extends Controller
{
    private const PURPOSES = 'deposit,balance,full,registration,previous,other';

    private const METHODS = 'cash,transfer,mobile_money,card,other';

    public function index(Request $request, Enrollment $enrollment): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        return response()->json(['data' => $this->payload($enrollment)]);
    }

    public function store(Request $request, Enrollment $enrollment, ActivityLogger $activity): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:100000000'],
            'method' => ['required', 'in:'.self::METHODS],
            'purpose' => ['nullable', 'in:'.self::PURPOSES],
            'reference' => ['nullable', 'string', 'max:120'],
            'paid_at' => ['nullable', 'date', 'before_or_equal:now'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $result = DB::transaction(function () use ($enrollment, $data, $request) {
            $locked = Enrollment::query()->whereKey($enrollment->id)->lockForUpdate()->firstOrFail();
            $s = EnrollmentBalance::summary($locked);

            if (! $s['tracked']) {
                return ['error' => 'Cette inscription est antérieure au suivi des paiements : activez d\'abord le suivi.'];
            }
            $amount = (int) $data['amount'];
            if ($amount > $s['balance']) {
                return ['error' => 'Le montant dépasse le solde restant ('.$s['balance'].').'];
            }

            $first = $s['paid'] === 0;
            $full = $amount >= $s['balance'];
            $purpose = $data['purpose'] ?? ($full ? ($first ? 'full' : 'balance') : ($first ? 'deposit' : 'other'));

            $payment = EnrollmentPayment::query()->create([
                'enrollment_id' => $locked->id,
                'amount' => $amount,
                'method' => $data['method'],
                'purpose' => $purpose,
                'reference' => $data['reference'] ?? null,
                'paid_at' => $data['paid_at'] ?? now(),
                'recorded_by' => $request->user()->id,
                'note' => $data['note'] ?? null,
            ]);

            return ['payment' => $payment];
        });

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], 422);
        }

        $this->log($activity, $request, 'enrollment.payment_recorded', $enrollment, [
            'enrollment_id' => $enrollment->id,
            'amount' => (int) $data['amount'],
            'method' => $data['method'],
            'purpose' => $result['payment']->purpose,
        ]);

        return response()->json(['data' => $this->payload($enrollment->refresh())], 201);
    }

    public function update(Request $request, Enrollment $enrollment, int $payment, ActivityLogger $activity): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $data = $request->validate([
            'amount' => ['sometimes', 'integer', 'min:1', 'max:100000000'],
            'method' => ['sometimes', 'in:'.self::METHODS],
            'purpose' => ['sometimes', 'in:'.self::PURPOSES],
            'reference' => ['sometimes', 'nullable', 'string', 'max:120'],
            'paid_at' => ['sometimes', 'date', 'before_or_equal:now'],
            'note' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $result = DB::transaction(function () use ($enrollment, $payment, $data) {
            $locked = Enrollment::query()->whereKey($enrollment->id)->lockForUpdate()->firstOrFail();
            $row = EnrollmentPayment::query()->where('enrollment_id', $locked->id)->whereKey($payment)->lockForUpdate()->first();

            if ($row === null) {
                return ['error' => 'Versement introuvable.', 'status' => 404];
            }
            if ($row->order_id !== null) {
                return ['error' => 'Un versement issu d\'une commande ne peut pas être modifié ici.', 'status' => 422];
            }
            if (isset($data['amount'])) {
                $max = EnrollmentBalance::summary($locked)['balance'] + (int) $row->amount;
                if ((int) $data['amount'] > $max) {
                    return ['error' => 'Le montant dépasse le solde restant ('.$max.').', 'status' => 422];
                }
            }

            $before = ['amount' => (int) $row->amount, 'method' => $row->method, 'purpose' => $row->purpose];
            $row->fill($data)->save();

            return ['before' => $before, 'row' => $row];
        });

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], $result['status']);
        }

        $this->log($activity, $request, 'enrollment.payment_updated', $enrollment, [
            'enrollment_id' => $enrollment->id,
            'payment_id' => $payment,
            'before' => $result['before'],
            'after' => ['amount' => (int) $result['row']->amount, 'method' => $result['row']->method, 'purpose' => $result['row']->purpose],
        ]);

        return response()->json(['data' => $this->payload($enrollment->refresh())]);
    }

    public function destroy(Request $request, Enrollment $enrollment, int $payment, ActivityLogger $activity): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $row = EnrollmentPayment::query()->where('enrollment_id', $enrollment->id)->whereKey($payment)->first();
        if ($row === null) {
            return response()->json(['message' => 'Versement introuvable.'], 404);
        }
        if ($row->order_id !== null) {
            return response()->json(['message' => 'Un versement issu d\'une commande ne peut pas être supprimé ici.'], 422);
        }

        $amount = (int) $row->amount;
        $row->delete();

        $this->log($activity, $request, 'enrollment.payment_deleted', $enrollment, [
            'enrollment_id' => $enrollment->id,
            'amount' => $amount,
        ]);

        return response()->json(['data' => $this->payload($enrollment->refresh())]);
    }

    /** Active le suivi sur une inscription anterieure : prix convenu et montant deja paye. */
    public function startTracking(Request $request, Enrollment $enrollment, ActivityLogger $activity): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $data = $request->validate([
            'agreed_price' => ['required', 'integer', 'min:0', 'max:100000000'],
            'already_paid' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'method' => ['nullable', 'in:'.self::METHODS],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        $paid = (int) ($data['already_paid'] ?? 0);
        if ($paid > (int) $data['agreed_price']) {
            return response()->json(['message' => 'Le montant déjà payé dépasse le prix convenu.'], 422);
        }

        $result = DB::transaction(function () use ($enrollment, $data, $paid, $request) {
            $locked = Enrollment::query()->whereKey($enrollment->id)->lockForUpdate()->firstOrFail();
            if ($locked->payment_tracked) {
                return ['error' => 'Le suivi des paiements est déjà actif pour cette inscription.'];
            }

            $locked->forceFill(['payment_tracked' => true, 'agreed_price' => (int) $data['agreed_price']])->save();

            if ($paid > 0) {
                EnrollmentPayment::query()->create([
                    'enrollment_id' => $locked->id,
                    'amount' => $paid,
                    'method' => $data['method'] ?? 'other',
                    'purpose' => 'previous',
                    'paid_at' => now(),
                    'recorded_by' => $request->user()->id,
                    'note' => $data['note'] ?? 'Reprise des paiements antérieurs',
                ]);
            }

            return ['ok' => true];
        });

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], 422);
        }

        $this->log($activity, $request, 'enrollment.payment_tracking_started', $enrollment, [
            'enrollment_id' => $enrollment->id,
            'agreed_price' => (int) $data['agreed_price'],
            'already_paid' => $paid,
        ]);

        return response()->json(['data' => $this->payload($enrollment->refresh())], 201);
    }

    public function access(Request $request, Enrollment $enrollment, ActivityLogger $activity): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $data = $request->validate(['override' => ['nullable', 'in:granted,blocked']]);
        $enrollment->forceFill(['access_override' => $data['override'] ?? null])->save();

        $this->log($activity, $request, 'enrollment.access_changed', $enrollment, [
            'enrollment_id' => $enrollment->id,
            'override' => $data['override'] ?? null,
        ]);

        return response()->json(['data' => $this->payload($enrollment->refresh())]);
    }

    /** @param array<string, mixed> $meta */
    private function log(ActivityLogger $activity, Request $request, string $action, Enrollment $enrollment, array $meta): void
    {
        try {
            $activity->log($request->user(), $action, $enrollment, $meta);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /** @return array<string, mixed> */
    private function payload(Enrollment $enrollment): array
    {
        $enrollment->loadMissing(['course:id,title,price,deposit_type,deposit_value,access_policy', 'user:id,name,email']);
        $rows = EnrollmentPayment::query()->where('enrollment_id', $enrollment->id)->orderByDesc('paid_at')->orderByDesc('id')->get();
        $names = User::query()->whereIn('id', $rows->pluck('recorded_by')->filter()->unique())->pluck('name', 'id');

        return [
            'enrollment_id' => $enrollment->id,
            'user_name' => $enrollment->user?->name,
            'course_title' => $enrollment->course?->title,
            'summary' => EnrollmentBalance::summary($enrollment),
            'deposit' => $enrollment->course ? EnrollmentBalance::depositFor($enrollment->course) : 0,
            'access' => [
                'policy' => (string) ($enrollment->course?->access_policy ?? 'always'),
                'override' => $enrollment->access_override,
                'granted' => EnrollmentBalance::hasAccess($enrollment),
            ],
            'payments' => $rows->map(fn (EnrollmentPayment $p) => [
                'id' => $p->id,
                'amount' => (int) $p->amount,
                'method' => $p->method,
                'purpose' => $p->purpose,
                'reference' => $p->reference,
                'paid_at' => $p->paid_at?->toIso8601String(),
                'note' => $p->note,
                'from_order' => $p->order_id !== null,
                'recorded_by' => $names[$p->recorded_by] ?? null,
            ])->values(),
        ];
    }
}