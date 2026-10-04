<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LiveKitController extends Controller
{
    public function token(Request $request, LiveKitService $liveKit): JsonResponse
    {
        $validated = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
        ]);

        $course = Course::query()->findOrFail($validated['course_id']);

        $this->authorize('stream', $course);

        if ($course->livekit_room === null || $course->livekit_room === '') {
            return response()->json([
                'message' => 'Aucune session en direct n\'est configurée pour ce cours.',
            ], 422);
        }

        $user = $request->user();

        try {
            $data = $liveKit->createRoomToken(
                $course->livekit_room,
                'user-'.$user->id,
                3600,
                (bool) $user->is_admin,
                $user->name,
            );
        } catch (\RuntimeException $exception) {
            Log::warning('LiveKit indisponible: '.$exception->getMessage());

            return response()->json([
                'message' => 'La visioconférence est temporairement indisponible. Veuillez réessayer plus tard.',
            ], 503);
        }

        return response()->json(['data' => $data]);
    }
}