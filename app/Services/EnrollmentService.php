<?php

namespace App\Services;

use App\Models\Enrollment;
use Illuminate\Support\Facades\Log;

class EnrollmentService
{
    /**
     * Nombre minimum de secondes requis par point de progression gagne.
     * Empeche un saut instantane de progression (ex: 0 a 100% en un appel),
     * en attendant un suivi reel du temps de lecture cote frontend.
     */
    private const MIN_SECONDS_PER_PERCENT_POINT = 0.6;

    public function __construct(
        private readonly CertificateService $certificates,
    ) {}

    public function updateProgress(Enrollment $enrollment, int $requestedProgress): Enrollment
    {
        $requestedProgress = max(0, min(100, $requestedProgress));
        $previousProgress = $enrollment->progress;

        // La progression ne recule jamais : on ne retient que le maximum atteint.
        $progress = max($previousProgress, $requestedProgress);
        $delta = $progress - $previousProgress;

        if ($delta > 0) {
            $elapsedSeconds = $enrollment->updated_at !== null
                ? abs(now()->diffInSeconds($enrollment->updated_at))
                : PHP_INT_MAX;

            $minElapsedRequired = $delta * self::MIN_SECONDS_PER_PERCENT_POINT;

            if ($elapsedSeconds < $minElapsedRequired) {
                throw new \RuntimeException(
                    'Progression trop rapide detectee. Veuillez continuer a suivre le cours normalement.'
                );
            }
        }

        $payload = ['progress' => $progress];
        if ($progress >= 100) {
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
            Log::warning('Emission automatique du certificat impossible.', [
                'enrollment_id' => $enrollment->id,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
