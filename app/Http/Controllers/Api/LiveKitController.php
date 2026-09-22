<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LiveKit\LiveKitTokenRequest;
use App\Models\Course;
use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;

class LiveKitController extends Controller
{
    public function token(LiveKitTokenRequest $request, LiveKitService $liveKit): JsonResponse
    {
        $user = $request->user();
        $room = $request->validated('room');

        if ($request->filled('course_id')) {
            $course = Course::query()->findOrFail((int) $request->validated('course_id'));
            $this->authorize('joinLiveSession', $course);

            $room = $course->livekit_room ?: ('course-'.$course->slug);
        }

        if ($room === null || $room === '') {
            return response()->json(['message' => 'Salle LiveKit introuvable.'], 422);
        }

        $identity = $request->validated('identity')
            ?? 'user-'.$user->id;

        return response()->json([
            'data' => $liveKit->createRoomToken($room, $identity),
        ]);
    }
}
