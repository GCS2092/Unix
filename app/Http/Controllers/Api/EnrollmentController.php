<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Enrollment\UpdateEnrollmentProgressRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use App\Services\EnrollmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EnrollmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Enrollment::class);

        $enrollments = Enrollment::query()
            ->where('user_id', $request->user()->id)
            ->with(['course', 'certificate'])
            ->latest('id')
            ->get();

        return response()->json([
            'data' => EnrollmentResource::collection(tap($enrollments, fn ($c) => Enrollment::preloadExamState($c))),
        ]);
    }

    public function show(Request $request, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('view', $enrollment);

        $enrollment->load(['course', 'certificate']);

        return response()->json([
            'data' => EnrollmentResource::make($enrollment),
        ]);
    }

    public function updateProgress(
        UpdateEnrollmentProgressRequest $request,
        Enrollment $enrollment,
        EnrollmentService $enrollments,
    ): JsonResponse {
        $this->authorize('update', $enrollment);

        try {
            if ($d = \App\Services\EnrollmentBalance::denial($enrollment, $request->user())) {
                return response()->json($d, 403);
            }
            $enrollment = $enrollments->updateProgress(
                $enrollment,
                (int) $request->validated('progress'),
            );
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'data' => EnrollmentResource::make($enrollment),
        ]);
    }

    public function complete(
        Request $request,
        Enrollment $enrollment,
        EnrollmentService $enrollments,
    ): JsonResponse {
        $this->authorize('update', $enrollment);

        try {
            if ($d = \App\Services\EnrollmentBalance::denial($enrollment, $request->user())) {
                return response()->json($d, 403);
            }
            $enrollment = $enrollments->markCompleted($enrollment);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $enrollment->load(['course', 'certificate']);

        return response()->json([
            'data' => EnrollmentResource::make($enrollment),
        ]);
    }
}
