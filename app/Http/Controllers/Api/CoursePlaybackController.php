<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Services\BunnyStreamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CoursePlaybackController extends Controller
{
    public function show(Request $request, Course $course, BunnyStreamService $bunny): JsonResponse
    {
        $this->authorize('stream', $course);

        if ($course->stream_video_id === null || $course->stream_video_id === '') {
            return response()->json([
                'message' => 'Aucune vidéo configurée pour ce cours.',
            ], 422);
        }

        try {
            $playback = $bunny->signedEmbedUrl($course->stream_video_id);
        } catch (\RuntimeException $exception) {
            Log::warning('Bunny Stream indisponible: '.$exception->getMessage());

            return response()->json([
                'message' => 'La lecture vidéo est temporairement indisponible. Veuillez réessayer plus tard.',
            ], 503);
        }

        return response()->json([
            'data' => [
                'course_id' => $course->id,
                'playback' => $playback,
            ],
        ]);
    }
}