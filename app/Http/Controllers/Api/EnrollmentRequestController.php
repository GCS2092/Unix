<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\EnrollmentRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnrollmentRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = EnrollmentRequest::where('user_id', $request->user()->id)
            ->get(['id', 'course_id', 'status', 'created_at']);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'message' => ['nullable', 'string', 'max:500'],
        ]);

        $user = $request->user();
        $course = Course::findOrFail($data['course_id']);

        if (! $course->is_published) {
            abort(404);
        }

        if (Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->exists()) {
            return response()->json(['message' => 'Vous êtes déjà inscrit à ce cours.'], 422);
        }

        $existing = EnrollmentRequest::where('user_id', $user->id)->where('course_id', $course->id)->first();
        if ($existing && $existing->status === 'pending') {
            return response()->json(['data' => $existing], 200);
        }

        // Nouvelle demande, ou nouvelle tentative après un refus
        $req = EnrollmentRequest::updateOrCreate(
            ['user_id' => $user->id, 'course_id' => $course->id],
            ['status' => 'pending', 'message' => $data['message'] ?? null, 'decided_by' => null, 'decided_at' => null],
        );

        return response()->json(['data' => $req], 201);
    }
}
