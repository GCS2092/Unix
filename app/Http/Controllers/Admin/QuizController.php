<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Quiz;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuizController extends Controller
{
    public function show(Request $request, Course $course): JsonResponse
    {
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $quiz = Quiz::query()->with('questions')->where('course_id', $course->id)->first();

        return response()->json(['data' => $quiz ? $this->payload($quiz) : null]);
    }

    public function update(Request $request, Course $course, ActivityLogger $activity): JsonResponse
    {
        abort_unless($course->canBeManagedBy($request->user()), 403);

        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:160'],
            'passing_score' => ['required', 'integer', 'min:1', 'max:100'],
            'max_attempts' => ['required', 'integer', 'min:1', 'max:20'],
            'is_published' => ['required', 'boolean'],
            'questions' => ['required', 'array', 'min:1', 'max:100'],
            'questions.*.prompt' => ['required', 'string', 'max:1000'],
            'questions.*.options' => ['required', 'array', 'min:2', 'max:6'],
            'questions.*.options.*' => ['required', 'string', 'max:300'],
            'questions.*.correct_index' => ['required', 'integer', 'min:0'],
        ]);

        foreach ($data['questions'] as $i => $q) {
            if ($q['correct_index'] >= count($q['options'])) {
                throw ValidationException::withMessages([
                    "questions.$i.correct_index" => 'La bonne réponse doit correspondre à une option.',
                ]);
            }
        }

        $quiz = DB::transaction(function () use ($course, $data): Quiz {
            $quiz = Quiz::query()->updateOrCreate(
                ['course_id' => $course->id],
                [
                    'title' => $data['title'] ?? null,
                    'passing_score' => $data['passing_score'],
                    'max_attempts' => $data['max_attempts'],
                    'is_published' => (bool) $data['is_published'],
                ],
            );

            $quiz->questions()->delete();
            foreach (array_values($data['questions']) as $i => $q) {
                $quiz->questions()->create([
                    'prompt' => trim($q['prompt']),
                    'options' => array_values($q['options']),
                    'correct_index' => (int) $q['correct_index'],
                    'position' => $i,
                ]);
            }

            return $quiz->load('questions');
        });

        $activity->log($request->user(), 'quiz.saved', $course, [
            'quiz_id' => $quiz->id,
            'questions' => count($data['questions']),
            'published' => (bool) $data['is_published'],
        ]);

        return response()->json(['data' => $this->payload($quiz)]);
    }

    /** @return array<string, mixed> */
    private function payload(Quiz $quiz): array
    {
        return [
            'id' => $quiz->id,
            'title' => $quiz->title,
            'passing_score' => (int) $quiz->passing_score,
            'max_attempts' => (int) $quiz->max_attempts,
            'is_published' => (bool) $quiz->is_published,
            'questions' => $quiz->questions->map(fn ($q) => [
                'id' => $q->id,
                'prompt' => $q->prompt,
                'options' => $q->options,
                'correct_index' => (int) $q->correct_index,
            ])->values(),
        ];
    }
}