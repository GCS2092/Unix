<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiveStatusController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $live = Course::query()->where('is_live', true)->get(['id', 'title']);

        $enrollments = Enrollment::query()
            ->where('user_id', $user->id)
            ->whereIn('course_id', $live->pluck('id'))
            ->pluck('id', 'course_id');

        $items = $live
            ->filter(fn (Course $c) => $user->is_admin || $enrollments->has($c->id))
            ->map(fn (Course $c) => [
                'course_id' => $c->id,
                'enrollment_id' => $enrollments->get($c->id),
                'title' => $c->title,
            ])->values();

        return response()->json(['data' => $items]);
    }
}