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

        $pdf = Pdf::loadView('certificates.course', [
            'userName' => $enrollment->user->name,
            'courseTitle' => $enrollment->course->title,
            'issuedAt' => now(),
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
        ]);

        return $path;
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
