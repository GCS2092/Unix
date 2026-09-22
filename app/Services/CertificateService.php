<?php

namespace App\Services;

use App\Models\Certificate;
use App\Models\Enrollment;
use Barryvdh\DomPDF\Facade\Pdf;
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
            throw new \RuntimeException('Le cours n\'est pas terminé.');
        }

        $pdf = Pdf::loadView('certificates.course', [
            'userName' => $enrollment->user->name,
            'courseTitle' => $enrollment->course->title,
            'issuedAt' => now(),
        ]);

        $path = 'certificates/enrollment-'.$enrollment->id.'.pdf';
        $disk = $this->disk();

        Storage::disk($disk)->put($path, $pdf->output());

        Certificate::query()->create([
            'enrollment_id' => $enrollment->id,
            'file_path' => $path,
            'issued_at' => now(),
        ]);

        return $path;
    }

    private function disk(): string
    {
        return config('filesystems.default') === 'r2' ? 'r2' : 'local';
    }
}
