<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\Enrollment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CertificateService
{
    public function issueForEnrollment(Enrollment $enrollment): string
    {
        $enrollment->loadMissing(['user', 'course', 'certificate']);

        if ($enrollment->certificate !== null) {
            return $enrollment->certificate->file_path;
        }

        if (! $enrollment->isCompleted()) {
            throw new \RuntimeException('Le cours n\'est pas termine.');
        }

        if (! $enrollment->examPassed()) {
            throw new \RuntimeException('Vous devez réussir l\'examen final avant d\'obtenir le certificat.');
        }

        $code = $this->newCode();
        $verifyUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/verification/'.$code;

        $pdf = Pdf::loadView('certificates.course', [
            'userName' => $enrollment->user->name,
            'courseTitle' => $enrollment->course->title,
            'issuedAt' => now(),
            'code' => $code,
            'verifyUrl' => $verifyUrl,
        ]);

        $path = 'certificates/enrollment-'.$enrollment->id.'.pdf';
        $disk = $this->disk();

        $written = Storage::disk($disk)->put($path, $pdf->output());

        if ($written === false) {
            Log::error('Echec de l\'ecriture du certificat sur le disque.', [
                'enrollment_id' => $enrollment->id,
                'disk' => $disk,
                'path' => $path,
            ]);

            throw new \RuntimeException('Impossible d\'enregistrer le fichier du certificat.');
        }

        Certificate::query()->create([
            'enrollment_id' => $enrollment->id,
            'file_path' => $path,
            'issued_at' => now(),
            'code' => $code,
        ]);

        return $path;
    }

    /** Code lisible (ex. K7QM2-X9PWA), sans 0/O/1/I/L. */
    private function newCode(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

        do {
            $raw = '';
            for ($i = 0; $i < 10; $i++) {
                $raw .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $code = substr($raw, 0, 5).'-'.substr($raw, 5);
        } while (Certificate::query()->where('code', $code)->exists());

        return $code;
    }

    private function disk(): string
    {
        $preferred = config('filesystems.default');

        if ($preferred !== 'r2') {
            return 'local';
        }

        if ($this->isR2Configured()) {
            return 'r2';
        }

        Log::warning('Disque R2 configure par defaut mais credentials manquants, repli sur le stockage local.');

        return 'local';
    }

    private function isR2Configured(): bool
    {
        $disk = config('filesystems.disks.r2', []);

        return filled($disk['key'] ?? null)
            && filled($disk['secret'] ?? null)
            && filled($disk['bucket'] ?? null)
            && filled($disk['endpoint'] ?? null);
    }
}