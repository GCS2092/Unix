<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\QuizAttempt;
use App\Services\QuizService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QuizController extends Controller
{
    public function show(Request $request, Enrollment $enrollment, QuizService $quizzes): JsonResponse
    {
        $this->authorize('view', $enrollment);

        $quiz = $quizzes->publishedFor($enrollment);
        if ($quiz === null) {
            return response()->json(['message' => 'Aucun examen pour ce cours.'], 404);
        }

        $attempts = QuizAttempt::query()
            ->where('enrollment_id', $enrollment->id)
            ->where('quiz_id', $quiz->id)
            ->get();

        $videoDone = $enrollment->isCompleted();

        return response()->json(['data' => [
            'id' => $quiz->id,
            'title' => $quiz->title,
            'passing_score' => (int) $quiz->passing_score,
            'max_attempts' => (int) $quiz->max_attempts + (int) $enrollment->bonus_attempts,
            'attempts_used' => $attempts->count(),
            'best_score' => (int) $attempts->max('score'),
            'passed' => $attempts->contains('passed', true),
            'video_done' => $videoDone,
            // Les bonnes reponses ne quittent jamais le serveur
            'questions' => $videoDone
                ? $quiz->questions->map(fn ($q) => [
                    'id' => $q->id,
                    'prompt' => $q->prompt,
                    'options' => $q->options,
                ])->values()
                : [],
        ]]);
    }

    public function submit(Request $request, Enrollment $enrollment, QuizService $quizzes): JsonResponse
    {
        $this->authorize('update', $enrollment);

        $data = $request->validate([
            'answers' => ['required', 'array'],
            'answers.*' => ['nullable', 'integer', 'min:0', 'max:9'],
        ]);

        try {
            $result = $quizzes->submit($enrollment, $data['answers']);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $result]);
    }
}