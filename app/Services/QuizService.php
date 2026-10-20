<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class QuizService
{
    public function __construct(private readonly CertificateService $certificates)
    {
    }

    public function publishedFor(Enrollment $enrollment): ?Quiz
    {
        return Quiz::query()->with('questions')
            ->where('course_id', $enrollment->course_id)
            ->where('is_published', true)
            ->first();
    }

    /**
     * @param  array<int|string, mixed>  $answers  question_id => index de l'option choisie
     * @return array<string, mixed>
     */
    public function submit(Enrollment $enrollment, array $answers): array
    {
        $quiz = $this->publishedFor($enrollment);

        if ($quiz === null || $quiz->questions->isEmpty()) {
            throw new \RuntimeException('Aucun examen disponible pour ce cours.');
        }

        if (! $enrollment->isCompleted()) {
            throw new \RuntimeException('Terminez d\'abord la vidéo avant de passer l\'examen.');
        }

        $result = DB::transaction(function () use ($enrollment, $quiz, $answers): array {
            // Verrou : deux envois simultanes ne doivent pas depasser le nombre de tentatives
            $enrollment = Enrollment::query()->whereKey($enrollment->id)->lockForUpdate()->firstOrFail();

            $past = QuizAttempt::query()
                ->where('enrollment_id', $enrollment->id)
                ->where('quiz_id', $quiz->id)
                ->get();

            if ($past->contains('passed', true)) {
                throw new \RuntimeException('Vous avez déjà réussi cet examen.');
            }
            if ($past->count() >= (int) $quiz->max_attempts + (int) $enrollment->bonus_attempts) {
                throw new \RuntimeException('Nombre maximal de tentatives atteint. Contactez votre formateur.');
            }

            $total = $quiz->questions->count();
            $correct = 0;
            foreach ($quiz->questions as $q) {
                $given = $answers[$q->id] ?? null;
                if ($given !== null && (int) $given === (int) $q->correct_index) {
                    $correct++;
                }
            }

            $score = (int) round($correct * 100 / $total);
            $passed = $score >= (int) $quiz->passing_score;

            QuizAttempt::query()->create([
                'quiz_id' => $quiz->id,
                'enrollment_id' => $enrollment->id,
                'score' => $score,
                'passed' => $passed,
                'answers' => $answers,
            ]);

            $used = $past->count() + 1;

            return [
                'score' => $score,
                'passed' => $passed,
                'correct' => $correct,
                'total' => $total,
                'passing_score' => (int) $quiz->passing_score,
                'attempts_used' => $used,
                'attempts_left' => max(0, (int) $quiz->max_attempts + (int) $enrollment->bonus_attempts - $used),
                'certificate_id' => null,
            ];
        });

        if ($result['passed']) {
            try {
                $fresh = Enrollment::query()->with(['course', 'user', 'certificate'])->find($enrollment->id);
                if ($fresh !== null) {
                    $this->certificates->issueForEnrollment($fresh);
                    $result['certificate_id'] = $fresh->fresh('certificate')?->certificate?->id;
                }
            } catch (\Throwable $e) {
                Log::warning('Certificat non emis apres examen reussi.', [
                    'enrollment_id' => $enrollment->id,
                    'message' => $e->getMessage(),
                ]);
            }
        }

        return $result;
    }
}