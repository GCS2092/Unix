<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\LiveSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LiveSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = LiveSession::query()
            ->with('course:id,title')
            ->where('starts_at', '>=', now()->subHours(2))
            ->orderBy('starts_at')
            ->limit(50);

        if (! $user->is_admin) {
            $query->whereIn('course_id', Enrollment::query()->where('user_id', $user->id)->select('course_id'));
        }

        $rows = $query->get()->map(fn (LiveSession $s) => [
            'id' => $s->id,
            'course_id' => $s->course_id,
            'course_title' => (string) ($s->course?->title ?? ''),
            'title' => $s->title,
            'starts_at' => $s->starts_at->toIso8601String(),
            'note' => $s->note,
        ])->values();

        return response()->json(['data' => $rows]);
    }
}