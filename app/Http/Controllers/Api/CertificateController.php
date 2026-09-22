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

        $path = $certificates->issueForEnrollment($enrollment);
        $enrollment->load('certificate');

        return response()->json([
            'data' => CertificateResource::make($enrollment->certificate),
            'file_path' => $path,
        ], 201);
    }

    public function download(Request $request, Certificate $certificate): StreamedResponse
    {
        $this->authorize('view', $certificate);

        $disk = config('filesystems.default') === 'r2' ? 'r2' : 'local';

        if (! Storage::disk($disk)->exists($certificate->file_path)) {
            abort(404, 'Fichier certificat introuvable.');
        }

        return Storage::disk($disk)->download(
            $certificate->file_path,
            'certificat-'.$certificate->id.'.pdf',
        );
    }
}
