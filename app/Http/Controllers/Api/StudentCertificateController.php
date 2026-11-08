<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\Enrollment;
use App\Services\CertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Espace etudiant : liste de MES certificats et apercu du PDF (le telechargement reste dans CertificateController). */
class StudentCertificateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $verifyBase = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/';

        $rows = Enrollment::query()
            ->with(['course:id,title', 'certificate'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->get()
            ->map(function (Enrollment $e) use ($verifyBase): array {
                $cert = $e->certificate;
                try {
                    if ($cert !== null) {
                        $status = $cert->revoked_at !== null ? 'revoked' : 'issued';
                    } elseif ($e->isCompleted()) {
                        $status = $e->examPassed() ? 'ready' : 'blocked';
                    } else {
                        $status = 'in_progress';
                    }
                } catch (\Throwable) {
                    $status = 'in_progress';
                }

                return [
                    'enrollment_id' => $e->id,
                    'course_id' => $e->course_id,
                    'course_title' => $e->course?->title,
                    'progress' => (int) $e->progress,
                    'status' => $status,
                    'certificate' => $cert === null ? null : [
                        'id' => $cert->id,
                        'code' => $cert->code,
                        'issued_at' => $cert->issued_at?->toIso8601String(),
                        'emailed_at' => $cert->emailed_at?->toIso8601String(),
                        'verify_url' => $verifyBase.$cert->code,
                    ],
                ];
            })
            ->values();

        return response()->json(['data' => $rows]);
    }

    /** PDF affiche dans la page (inline). Meme controle de propriete que le telechargement. */
    public function view(Request $request, Certificate $certificate, CertificateService $certificates): Response
    {
        $this->authorize('view', $certificate);
        abort_if($certificate->revoked_at !== null && ! $request->user()->is_admin, 403, 'Ce certificat a été révoqué.');

        $content = $certificates->contents($certificate);
        abort_if($content === null, 404, 'Fichier certificat introuvable.');

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="certificat-'.$certificate->id.'.pdf"',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}