<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LiveKitController extends Controller
{
    public function token(Request $request, LiveKitService $liveKit): JsonResponse
    {
        $validated = $request->validate([
            'room_name' => ['required', 'string', 'max:255'],
            'identity' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        $room = $validated['room_name'];

        $identity = $validated['identity']
            ?? 'user-'.$user->id;

        try {
            $data = $liveKit->createRoomToken(
                $room,
                $identity
            );
        } catch (\RuntimeException $exception) {
            Log::warning(
                'LiveKit indisponible: '.$exception->getMessage()
            );

            return response()->json([
                'message' => 'La visioconference est temporairement indisponible. Veuillez reessayer plus tard.',
            ], 503);
        }

        return response()->json([
            'data' => $data,
        ]);
    }
}