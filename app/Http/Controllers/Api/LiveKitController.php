<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LiveKit\LiveKitTokenRequest;
use App\Models\Course;
use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class LiveKitController extends Controller
{
    public function token(LiveKitTokenRequest $request, LiveKitService $liveKit): JsonResponse
    {
        $user = $request->user();

        $course = Course::query()->findOrFail((int) $request->validated('course_id'));
        $this->authorize('joinLiveSession', $course);

        $room = $course->livekit_room ?: ('course-'.$course->slug);
        $identity = $request->validated('identity') ?? 'user-'.$user->id;

        try {
            $data = $liveKit->createRoomToken($room, $identity);
        } catch (\RuntimeException $exception) {
            Log::warning('LiveKit indisponible: '.$exception->getMessage());

            return response()->json([
                'message' => 'La visioconference est temporairement indisponible. Veuillez reessayer plus tard.',
            ], 503);
        }

        return response()->json(['data' => $data]);
    }
}
