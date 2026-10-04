<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GuestLiveController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invite' => ['required', 'string', 'max:64'],
        ]);

        $course = Course::query()->where('invite_token', $data['invite'])->first();

        if ($course === null) {
            return response()->json(['message' => 'Lien d\'invitation invalide ou expire.'], 404);
        }

        return response()->json(['data' => [
            'is_live' => (bool) $course->is_live,
            'title' => (string) $course->title,
        ]]);
    }

    public function token(Request $request, LiveKitService $liveKit): JsonResponse
    {
        $data = $request->validate([
            'invite' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'min:2', 'max:60'],
        ]);

        $course = Course::query()->where('invite_token', $data['invite'])->first();

        if ($course === null || (string) $course->livekit_room === '') {
            return response()->json(['message' => 'Lien d\'invitation invalide ou expire.'], 404);
        }

        if (! (bool) $course->is_live) {
            return response()->json(['message' => __('live.not_started')], 409);
        }

        $canPublish = (bool) $course->meeting_mode;
        $identity = 'guest-'.Str::lower(Str::random(12));

        try {
            $token = $liveKit->createRoomToken(
                $course->livekit_room,
                $identity,
                3600,
                $canPublish,
                trim($data['name']).' (invite)',
                json_encode(['role' => 'guest']),
            );
        } catch (\RuntimeException $exception) {
            Log::warning('LiveKit indisponible (invite): '.$exception->getMessage());

            return response()->json(['message' => __('live.server_unavailable')], 503);
        }

        return response()->json(['data' => $token + ['can_publish' => $canPublish, 'is_host' => false]]);
    }
}