<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Services\ActivityLogger;
use App\Services\CertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnrollmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');

        $items = Enrollment::query()
            ->with(['user:id,name,email', 'course:id,title', 'certificate:id,enrollment_id,issued_at'])
            ->when($status === 'completed', fn ($w) => $w->where(
                fn ($x) => $x->where('progress', '>=', 100)->orWhereNotNull('completed_at'),
            ))
            ->when($status === 'in_progress', fn ($w) => $w->where('progress', '<', 100)->whereNull('completed_at'))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $w->where(function ($x) use ($like): void {
                    $x->whereHas('user', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like))
                        ->orWhereHas('course', fn ($c) => $c->where('title', 'like', $like));
                });
            })
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => $items->getCollection()->map(fn (Enrollment $e) => $this->payload($e))->values(),
            'meta' => [
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'total' => $items->total(),
            ],
        ]);
    }

    public function reissue(
        Request $request,
        Enrollment $enrollment,
        CertificateService $certificates,
        ActivityLogger $activity,
    ): JsonResponse {
        if (! $enrollment->isCompleted()) {
            return response()->json(['message' => 'Le cours doit être terminé avant d\'émettre un certificat.'], 422);
        }

        try {
            // Transaction : si la regeneration echoue, l'ancien certificat est conserve
            DB::transaction(function () use ($enrollment, $certificates): void {
                $enrollment->certificate()->delete();
                $enrollment->unsetRelation('certificate');
                $certificates->issueForEnrollment($enrollment);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $enrollment->load(['user:id,name,email', 'course:id,title', 'certificate:id,enrollment_id,issued_at']);

        $activity->log($request->user(), 'certificate.reissued', $enrollment, ['enrollment_id' => $enrollment->id]);

        return response()->json(['data' => $this->payload($enrollment)]);
    }

    /** @return array<string, mixed> */
    private function payload(Enrollment $e): array
    {
        return [
            'id' => $e->id,
            'user_name' => $e->user?->name,
            'user_email' => $e->user?->email,
            'course_title' => $e->course?->title,
            'progress' => (int) $e->progress,
            'completed' => $e->isCompleted(),
            'completed_at' => $e->completed_at?->toIso8601String(),
            'certificate_id' => $e->certificate?->id,
            'certificate_issued_at' => $e->certificate?->issued_at?->toIso8601String(),
            'created_at' => $e->created_at?->toIso8601String(),
        ];
    }
}