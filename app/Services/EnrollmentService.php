<?php

namespace App\Services;

use App\Models\Enrollment;
use Illuminate\Support\Facades\Log;

class EnrollmentService
{
    public function __construct(
        private readonly CertificateService $certificates,
    ) {}

    public function updateProgress(Enrollment $enrollment, int $progress): Enrollment
    {
        $progress = max(0, min(100, $progress));

        $payload = ['progress' => $progress];
        if ($progress >= 100) {
            $payload['progress'] = 100;
            $payload['completed_at'] = $enrollment->completed_at ?? now();
        }

        $enrollment->update($payload);
        $enrollment = $enrollment->fresh(['course', 'certificate']);

        if ($enrollment->isCompleted()) {
            $this->issueCertificateIfMissing($enrollment);
        }

        return $enrollment->fresh(['course', 'certificate']);
    }

    public function markCompleted(Enrollment $enrollment): Enrollment
    {
        return $this->updateProgress($enrollment, 100);
    }

    public function grantEnrollment(int $userId, int $courseId): Enrollment
    {
        return Enrollment::query()->firstOrCreate(
            [
                'user_id' => $userId,
                'course_id' => $courseId,
            ],
            ['progress' => 0],
        )->load(['course', 'certificate', 'user']);
    }

    private function issueCertificateIfMissing(Enrollment $enrollment): void
    {
        if ($enrollment->certificate) {
            return;
        }

        try {
            $this->certificates->issueForEnrollment($enrollment);
        } catch (\Throwable $exception) {
            Log::warning('Émission automatique du certificat impossible.', [
                'enrollment_id' => $enrollment->id,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
