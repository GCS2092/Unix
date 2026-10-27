<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\CertificateResource;
use App\Models\Certificate;
use App\Models\Enrollment;
use App\Services\CertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CertificateController extends Controller
{
    public function issue(
        Request $request,
        Enrollment $enrollment,
        CertificateService $certificates,
    ): JsonResponse {
        $this->authorize('update', $enrollment);

        if (! $enrollment->isCompleted()) {
            return response()->json([
                'message' => 'Le cours doit être terminé avant d\'émettre un certificat.',
            ], 422);
        }

        try {
            $path = $certificates->issueForEnrollment($enrollment);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
        $enrollment->load('certificate');

        return response()->json([
            'data' => CertificateResource::make($enrollment->certificate),
            'file_path' => $path,
        ], 201);
    }

    /** L'etudiant recoit son certificat par e-mail (une fois toutes les 2 minutes). */
    public function email(Request $request, Enrollment $enrollment, CertificateService $certificates): JsonResponse
    {
        $this->authorize('update', $enrollment);
        $enrollment->loadMissing(['user', 'course', 'certificate']);
        $cert = $enrollment->certificate;
        $user = $enrollment->user;

        if ($cert === null || $user === null) {
            return response()->json(['message' => "Aucun certificat n'a encore été délivré."], 422);
        }
        if ($cert->revoked_at !== null) {
            return response()->json(['message' => 'Ce certificat a été révoqué.'], 403);
        }
        if (! \App\Notifications\LiveInvitationNotification::mailReady()) {
            return response()->json(['message' => "L'envoi d'e-mails n'est pas disponible pour le moment."], 422);
        }
        if (! \Illuminate\Support\Facades\Cache::add('certificate-self-mail:'.$enrollment->id, 1, now()->addMinutes(2))) {
            return response()->json(['message' => 'Un e-mail vient déjà d\'être envoyé. Réessayez dans 2 minutes.'], 429);
        }

        $pdf = $certificates->contents($cert);
        if ($pdf === null) {
            \Illuminate\Support\Facades\Cache::forget('certificate-self-mail:'.$enrollment->id);

            return response()->json(['message' => 'Fichier du certificat introuvable. Contactez l\'équipe.'], 422);
        }

        try {
            $verify = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/'.$cert->code;
            $filename = 'certificat-'.\Illuminate\Support\Str::slug((string) $enrollment->course?->title).'.pdf';
            $user->notify(new \App\Notifications\CertificateDeliveredNotification(
                (string) ($enrollment->course?->title ?? ''), $pdf, $filename, (string) $cert->code, $verify,
            ));
            $cert->forceFill(['emailed_at' => now()])->save();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Cache::forget('certificate-self-mail:'.$enrollment->id);
            report($e);

            return response()->json(['message' => "L'e-mail n'a pas pu être envoyé."], 422);
        }

        return response()->json(['data' => ['sent' => true, 'email' => $user->email]]);
    }

    public function download(Request $request, Certificate $certificate, CertificateService $certificates): \Symfony\Component\HttpFoundation\Response
    {
        $this->authorize('view', $certificate);
        abort_if($certificate->revoked_at !== null && ! $request->user()->is_admin, 403, 'Ce certificat a été révoqué.');

        $content = $certificates->contents($certificate);
        abort_if($content === null, 404, 'Fichier certificat introuvable.');

        return response($content, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="certificat-'.$certificate->id.'.pdf"',
        ]);
    }
}