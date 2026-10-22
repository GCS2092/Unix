<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CertificateSetting;
use App\Services\CertificateService;
use App\Support\MediaDisk;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class CertificateTemplateController extends Controller
{
    private function payload(CertificateService $certs): array
    {
        $raw = CertificateSetting::values();
        $tpl = $certs->template();

        return [
            'brand' => $raw['brand'],
            'signer_name' => $raw['signer_name'],
            'signer_title' => $raw['signer_title'],
            'color' => $tpl['color'],
            'logo_data' => $tpl['logo'],
            'signature_data' => $tpl['signature'],
            'default_brand' => (string) config('app.name'),
        ];
    }

    public function show(CertificateService $certs): JsonResponse
    {
        return response()->json(['data' => $this->payload($certs)]);
    }

    public function update(Request $request, CertificateService $certs): JsonResponse
    {
        $data = $request->validate([
            'brand' => ['nullable', 'string', 'max:120'],
            'signer_name' => ['nullable', 'string', 'max:120'],
            'signer_title' => ['nullable', 'string', 'max:120'],
            'color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);
        CertificateSetting::put($data);

        return response()->json(['data' => $this->payload($certs)]);
    }

    public function upload(Request $request, string $slot, CertificateService $certs): JsonResponse
    {
        $request->validate(['image' => ['required', 'file', 'mimes:png,jpg,jpeg', 'max:1024']]);

        $file = $request->file('image');
        $name = Str::random(24).'.'.strtolower($file->getClientOriginalExtension() ?: 'png');
        MediaDisk::disk()->putFileAs('certificate-assets', $file, $name);

        $old = CertificateSetting::values()[$slot] ?? '';
        if ($old !== '') {
            MediaDisk::disk()->delete('certificate-assets/'.basename($old));
        }
        CertificateSetting::put([$slot => $name]);

        return response()->json(['data' => $this->payload($certs)]);
    }

    public function remove(string $slot, CertificateService $certs): JsonResponse
    {
        $old = CertificateSetting::values()[$slot] ?? '';
        if ($old !== '') {
            MediaDisk::disk()->delete('certificate-assets/'.basename($old));
        }
        CertificateSetting::put([$slot => '']);

        return response()->json(['data' => $this->payload($certs)]);
    }

    /** PDF d'essai avec des donnees d'exemple (rien n'est enregistre). */
    public function preview(CertificateService $certs): Response
    {
        $pdf = Pdf::loadView('certificates.course', [
            'userName' => 'Awa Diop',
            'courseTitle' => 'Introduction à la gestion de projet',
            'issuedAt' => now(),
            'code' => 'K7QM2-X9PWA',
            'verifyUrl' => rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/K7QM2-X9PWA',
            'birthDate' => '14/03/1998',
            'birthPlace' => 'Dakar, Sénégal',
            'tpl' => $certs->template(),
            'qr' => $certs->qr(rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/K7QM2-X9PWA'),
        ]);

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="apercu-certificat.pdf"',
        ]);
    }
}