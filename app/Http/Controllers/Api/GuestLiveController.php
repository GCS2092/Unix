<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\LiveJoinRequest;
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
            'require_admission' => (bool) $course->require_admission,
        ]]);
    }

    public function createRequest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invite' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'min:2', 'max:60'],
        ]);

        $course = Course::query()->where('invite_token', $data['invite'])->first();

        if ($course === null) {
            return response()->json(['message' => 'Lien d\'invitation invalide ou expire.'], 404);
        }

        if (! (bool) $course->require_admission) {
            return response()->json(['data' => ['id' => null, 'secret' => null, 'status' => 'admitted']]);
        }

        $pending = LiveJoinRequest::query()
            ->where('course_id', $course->id)
            ->where('status', 'pending')
            ->where('created_at', '>', now()->subHours(2))
            ->count();

        if ($pending >= 30) {
            return response()->json(['message' => 'Trop de demandes en attente. Reessayez dans quelques minutes.'], 429);
        }

        $secret = Str::random(40);

        $req = LiveJoinRequest::query()->create([
            'course_id' => $course->id,
            'name' => trim($data['name']),
            'secret_hash' => hash('sha256', $secret),
            'status' => 'pending',
        ]);

        return response()->json(['data' => ['id' => $req->id, 'secret' => $secret, 'status' => 'pending']]);
    }

    public function requestStatus(Request $request, int $id): JsonResponse
    {
        $secret = (string) $request->query('secret', '');
        $req = LiveJoinRequest::query()->find($id);

        if ($req === null || ! hash_equals($req->secret_hash, hash('sha256', $secret))) {
            return response()->json(['message' => 'Demande introuvable.'], 404);
        }

        return response()->json(['data' => ['status' => $req->status]]);
    }

    public function token(Request $request, LiveKitService $liveKit): JsonResponse
    {
        $data = $request->validate([
            'invite' => ['required', 'string', 'max:64'],
            'name' => ['required', 'string', 'min:2', 'max:60'],
            'request_id' => ['nullable', 'integer'],
            'secret' => ['nullable', 'string', 'max:64'],
        ]);

        $course = Course::query()->where('invite_token', $data['invite'])->first();

        if ($course === null || (string) $course->livekit_room === '') {
            return response()->json(['message' => 'Lien d\'invitation invalide ou expire.'], 404);
        }

        $name = trim($data['name']);

        if ((bool) $course->require_admission) {
            $req = LiveJoinRequest::query()
                ->where('course_id', $course->id)
                ->where('id', (int) ($data['request_id'] ?? 0))
                ->first();

            $valid = $req !== null
                && isset($data['secret'])
                && hash_equals($req->secret_hash, hash('sha256', (string) $data['secret']));

            if (! $valid || $req->status !== 'admitted' || $req->decided_at === null || $req->decided_at->lt(now()->subHours(6))) {
                return response()->json(['message' => 'Admission requise : attendez que l\'organisateur vous autorise a entrer.'], 403);
            }

            $name = $req->name;
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
                $name.' (invite)',
                json_encode(['role' => 'guest']),
            );
        } catch (\RuntimeException $exception) {
            Log::warning('LiveKit indisponible (invite): '.$exception->getMessage());

            return response()->json(['message' => __('live.server_unavailable')], 503);
        }

        return response()->json(['data' => $token + ['can_publish' => $canPublish, 'is_host' => false]]);
    }
}