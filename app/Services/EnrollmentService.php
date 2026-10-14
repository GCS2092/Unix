<?php

namespace App\Services;

use App\Models\Enrollment;
use Illuminate\Support\Facades\Log;

class EnrollmentService
{
    /** Le client envoie un signal toutes les 20 s : on ne crédite jamais plus que ça par appel. */
    private const MAX_CREDIT_PER_CALL = 25;

    public function __construct(
        private readonly CertificateService $certificates,
    ) {}

    public function updateProgress(Enrollment $enrollment, int $requested): Enrollment
    {
        $requested = max(0, min(100, $requested));
        $now = now();

        // Temps de visionnage crédité = temps réel écoulé depuis le dernier signal, plafonné
        $credit = $enrollment->last_heartbeat_at
            ? min((int) abs($now->diffInSeconds($enrollment->last_heartbeat_at, true)), self::MAX_CREDIT_PER_CALL)
            : 0;
        $watch = $enrollment->watch_seconds + $credit;

        $duration = $enrollment->course->duration_seconds;
        $allowed = $duration
            ? min(100, intdiv($watch * 100, $duration) + 2)   // petite marge
            : $requested;                                      // durée inconnue : pas de plafond

        $progress = max($enrollment->progress, min($requested, $allowed));

        $payload = [
            'progress' => $progress,
            'watch_seconds' => $watch,
            'last_heartbeat_at' => $now,
        ];
        if ($progress >= 100) {
            $payload['completed_at'] = $enrollment->completed_at ?? $now;
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
        // N'accepte que si le serveur a déjà validé l'essentiel du visionnage
        if ($enrollment->progress < 90 && ! $enrollment->isCompleted()) {
            throw new \RuntimeException('Terminez d\'abord le cours pour obtenir votre certificat.');
        }
        $enrollment->update([
            'progress' => 100,
            'completed_at' => $enrollment->completed_at ?? now(),
        ]);
        $enrollment = $enrollment->fresh(['course', 'certificate']);
        $this->issueCertificateIfMissing($enrollment);

        return $enrollment->fresh(['course', 'certificate']);
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