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
    public function index(Request $request, Enrollment $enrollment): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        return $this->indexInner($enrollment);
    }

    private function indexInner(Enrollment $enrollment): JsonResponse
    {
        return response()->json(['data' => $this->payload($enrollment)]);
    }

    public function store(Request $request, Enrollment $enrollment, ActivityLogger $activity): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:100000000'],
            'method' => ['required', 'in:cash,transfer,mobile_money,card,other'],
            'reference' => ['nullable', 'string', 'max:120'],
            'paid_at' => ['nullable', 'date', 'before_or_equal:now'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $result = DB::transaction(function () use ($enrollment, $data, $request) {
            $locked = Enrollment::query()->whereKey($enrollment->id)->lockForUpdate()->firstOrFail();
            $s = EnrollmentBalance::summary($locked);

            if (! $s['tracked']) {
                return ['error' => "Cette inscription est antérieure au suivi des paiements : elle est considérée comme soldée."];
            }
            if ((int) $data['amount'] > $s['balance']) {
                return ['error' => 'Le montant dépasse le solde restant ('.$s['balance'].').'];
            }

            $payment = EnrollmentPayment::query()->create([
                'enrollment_id' => $locked->id,
                'amount' => (int) $data['amount'],
                'method' => $data['method'],
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

        try {
            $activity->log($request->user(), 'enrollment.payment_recorded', $enrollment, [
                'enrollment_id' => $enrollment->id,
                'amount' => (int) $data['amount'],
                'method' => $data['method'],
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['data' => $this->payload($enrollment->refresh())], 201);
    }

    public function access(Request $request, Enrollment $enrollment, ActivityLogger $activity): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $data = $request->validate(['override' => ['nullable', 'in:granted,blocked']]);
        $enrollment->forceFill(['access_override' => $data['override'] ?? null])->save();

        try {
            $activity->log($request->user(), 'enrollment.access_changed', $enrollment, [
                'enrollment_id' => $enrollment->id,
                'override' => $data['override'] ?? null,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

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

        try {
            $activity->log($request->user(), 'enrollment.payment_deleted', $enrollment, [
                'enrollment_id' => $enrollment->id,
                'amount' => $amount,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json(['data' => $this->payload($enrollment->refresh())]);
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
                'reference' => $p->reference,
                'paid_at' => $p->paid_at?->toIso8601String(),
                'note' => $p->note,
                'from_order' => $p->order_id !== null,
                'recorded_by' => $names[$p->recorded_by] ?? null,
            ])->values(),
        ];
    }
}