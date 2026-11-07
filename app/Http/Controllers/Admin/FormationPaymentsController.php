<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\EnrollmentPayment;
use App\Models\User;
use App\Services\EnrollmentBalance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Vue d'ensemble des paiements de la formation : soldes par etudiant et historique des versements. */
class FormationPaymentsController extends Controller
{
    private const TOTAL = 'coalesce(enrollments.agreed_price, (select c.price from courses c where c.id = enrollments.course_id), 0)';

    private const PAID = '(select coalesce(sum(p.amount), 0) from enrollment_payments p where p.enrollment_id = enrollments.id)';

    private const PURPOSES = ['deposit', 'balance', 'full', 'registration', 'previous', 'other'];

    private function like(string $q): string
    {
        return '%'.addcslashes(mb_strtolower($q), '%_\\').'%';
    }

    /** @return array<string, int> */
    private function totals(): array
    {
        $row = DB::selectOne(
            'select
                coalesce(sum(paid), 0) as collected,
                coalesce(sum(greatest(total - paid, 0)), 0) as outstanding,
                count(*) filter (where paid = 0 and total > 0) as pending,
                count(*) filter (where paid > 0 and paid < total) as deposit_paid,
                count(*) filter (where paid >= total) as settled
             from (
                select coalesce(e.agreed_price, c.price, 0) as total,
                       coalesce((select sum(p.amount) from enrollment_payments p where p.enrollment_id = e.id), 0) as paid
                from enrollments e left join courses c on c.id = e.course_id
                where e.payment_tracked = true
             ) t'
        );

        return [
            'collected' => (int) ($row->collected ?? 0),
            'outstanding' => (int) ($row->outstanding ?? 0),
            'pending' => (int) ($row->pending ?? 0),
            'deposit_paid' => (int) ($row->deposit_paid ?? 0),
            'settled' => (int) ($row->settled ?? 0),
            'legacy_count' => Enrollment::query()->where('payment_tracked', false)->count(),
        ];
    }

    public function index(Request $request): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $status = (string) $request->query('status', '');
        $q = trim((string) $request->query('q', ''));
        $courseId = (int) $request->query('course_id', 0);
        $tracked = $status !== 'legacy';

        $page = Enrollment::query()
            ->where('enrollments.payment_tracked', $tracked)
            ->with(['user:id,name,email,phone', 'course:id,title,price,access_policy,balance_due_days'])
            ->select('enrollments.*')
            ->selectRaw(self::PAID.' as paid_total')
            ->selectRaw(self::TOTAL.' as total_price')
            ->when($courseId > 0, fn ($w) => $w->where('enrollments.course_id', $courseId))
            ->when($status === 'pending', fn ($w) => $w->whereRaw(self::PAID.' = 0')->whereRaw(self::TOTAL.' > 0'))
            ->when($status === 'deposit_paid', fn ($w) => $w->whereRaw(self::PAID.' > 0')->whereRaw(self::PAID.' < '.self::TOTAL))
            ->when($status === 'settled', fn ($w) => $w->whereRaw(self::PAID.' >= '.self::TOTAL))
            ->when($q !== '', function ($w) use ($q): void {
                $like = $this->like($q);
                $w->whereHas('user', function ($u) use ($like): void {
                    $u->whereRaw('lower(name) like ?', [$like])->orWhereRaw('lower(email) like ?', [$like]);
                });
            })
            ->orderByDesc('enrollments.id')
            ->paginate(20);

        $rows = $page->getCollection()->map(function (Enrollment $e): array {
            $isTracked = (bool) $e->payment_tracked;
            $total = (int) $e->total_price;
            $paid = $isTracked ? (int) $e->paid_total : $total;

            return [
                'id' => $e->id,
                'tracked' => $isTracked,
                'user_name' => $e->user?->name,
                'user_email' => $e->user?->email,
                'user_phone' => $e->user?->phone,
                'course_title' => $e->course?->title,
                'total' => $total,
                'paid' => $paid,
                'balance' => max(0, $total - $paid),
                'status' => ! $isTracked ? 'legacy' : ($paid >= $total ? 'settled' : ($paid > 0 ? 'deposit_paid' : 'pending')),
                'access_granted' => EnrollmentBalance::hasAccess($e),
                'access_override' => $e->access_override,
                'due_at' => EnrollmentBalance::dueAt($e)?->toIso8601String(),
                'overdue' => EnrollmentBalance::isOverdue($e),
                'created_at' => $e->created_at?->toIso8601String(),
            ];
        })->values();

        return response()->json([
            'data' => $rows,
            'totals' => $this->totals(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        abort_if($request->user()->isInstructorOnly(), 403);

        $method = (string) $request->query('method', '');
        $purpose = (string) $request->query('purpose', '');
        $q = trim((string) $request->query('q', ''));

        $page = EnrollmentPayment::query()
            ->with(['enrollment.user:id,name,email', 'enrollment.course:id,title'])
            ->when(in_array($method, ['cash', 'transfer', 'mobile_money', 'card', 'other'], true), fn ($w) => $w->where('method', $method))
            ->when(in_array($purpose, self::PURPOSES, true), fn ($w) => $w->where('purpose', $purpose))
            ->when($q !== '', function ($w) use ($q): void {
                $like = $this->like($q);
                $w->whereHas('enrollment.user', function ($u) use ($like): void {
                    $u->whereRaw('lower(name) like ?', [$like])->orWhereRaw('lower(email) like ?', [$like]);
                });
            })
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->paginate(20);

        $names = User::query()->whereIn('id', $page->getCollection()->pluck('recorded_by')->filter()->unique())->pluck('name', 'id');

        $rows = $page->getCollection()->map(fn (EnrollmentPayment $p) => [
            'id' => $p->id,
            'enrollment_id' => $p->enrollment_id,
            'amount' => (int) $p->amount,
            'method' => $p->method,
            'purpose' => $p->purpose,
            'reference' => $p->reference,
            'paid_at' => $p->paid_at?->toIso8601String(),
            'note' => $p->note,
            'from_order' => $p->order_id !== null,
            'recorded_by' => $names[$p->recorded_by] ?? null,
            'user_name' => $p->enrollment?->user?->name,
            'user_email' => $p->enrollment?->user?->email,
            'course_title' => $p->enrollment?->course?->title,
        ])->values();

        return response()->json([
            'data' => $rows,
            'totals' => $this->totals(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }
}