<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Services\ActivityLogger;
use App\Services\CertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class EnrollmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $items = $this->filtered($request)
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

    private function filtered(Request $request): \Illuminate\Database\Eloquent\Builder
    {
        $q = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');

        return Enrollment::query()
            ->with(['user:id,name,email', 'course:id,title', 'certificate:id,enrollment_id,issued_at'])
            ->when($status === 'completed', fn ($w) => $w->where(
                fn ($x) => $x->where('progress', '>=', 100)->orWhereNotNull('completed_at'),
            ))
            ->when($status === 'in_progress', fn ($w) => $w->where('progress', '<', 100)->whereNull('completed_at'))
            ->when($status === 'to_certify', fn ($w) => $w->whereDoesntHave('certificate')->where(
                fn ($x) => $x->where('progress', '>=', 100)->orWhereNotNull('completed_at'),
            ))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.addcslashes($q, '%_\\').'%';
                $w->where(function ($x) use ($like): void {
                    $x->whereHas('user', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like))
                        ->orWhereHas('course', fn ($c) => $c->where('title', 'like', $like));
                });
            });
    }

    public function export(Request $request): BinaryFileResponse
    {
        // Neutralise l'injection de formules Excel (=, +, -, @ en debut de cellule)
        $safe = fn ($v) => (is_string($v) && $v !== '' && str_contains('=+-@', $v[0])) ? "'".$v : $v;
        $date = fn ($d) => $d?->format('d/m/Y') ?? '';

        $path = tempnam(sys_get_temp_dir(), 'enr');
        $writer = new Writer();
        $writer->openToFile($path);
        $writer->getCurrentSheet()->setName('Inscriptions');
        $writer->addRow(Row::fromValues([
            'Élève', 'E-mail', 'Cours', 'Progression (%)', 'Statut', 'Inscrit le', 'Terminé le', 'Certificat émis le',
        ])->setStyle((new Style())->setFontBold()));

        foreach ($this->filtered($request)->lazyById(500) as $e) {
            $writer->addRow(Row::fromValues([
                $safe($e->user?->name ?? ''),
                $safe($e->user?->email ?? ''),
                $safe($e->course?->title ?? ''),
                (int) $e->progress,
                $e->isCompleted() ? 'Terminé' : 'En cours',
                $date($e->created_at),
                $date($e->completed_at),
                $date($e->certificate?->issued_at),
            ]));
        }
        $writer->close();

        return response()
            ->download($path, 'inscriptions-'.now()->format('Y-m-d').'.xlsx', [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])
            ->deleteFileAfterSend(true);
    }

    public function grantAttempt(Request $request, Enrollment $enrollment, ActivityLogger $activity): JsonResponse
    {
        $quiz = \App\Models\Quiz::query()
            ->where('course_id', $enrollment->course_id)
            ->where('is_published', true)
            ->first();

        if ($quiz === null) {
            return response()->json(['message' => 'Ce cours n\'a pas d\'examen publié.'], 422);
        }
        if ($enrollment->examPassed()) {
            return response()->json(['message' => 'Cet élève a déjà réussi l\'examen.'], 422);
        }
        if ((int) $enrollment->bonus_attempts >= 20) {
            return response()->json(['message' => 'Limite de tentatives supplémentaires atteinte.'], 422);
        }

        $enrollment->increment('bonus_attempts');

        $activity->log($request->user(), 'quiz.attempt_granted', $enrollment, [
            'enrollment_id' => $enrollment->id,
            'bonus_attempts' => (int) $enrollment->bonus_attempts,
        ]);

        return response()->json(['data' => ['id' => $enrollment->id, 'bonus_attempts' => (int) $enrollment->bonus_attempts]]);
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
            'exam_required' => $e->examRequired(),
            'exam_passed' => $e->examPassed(),
            'certificate_issued_at' => $e->certificate?->issued_at?->toIso8601String(),
            'created_at' => $e->created_at?->toIso8601String(),
        ];
    }
}