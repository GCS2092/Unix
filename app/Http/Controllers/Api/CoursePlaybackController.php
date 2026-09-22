<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Services\BunnyStreamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        return response()->json([
            'data' => [
                'course_id' => $course->id,
                'playback' => $bunny->signedEmbedUrl($course->stream_video_id),
            ],
        ]);
    }
}
