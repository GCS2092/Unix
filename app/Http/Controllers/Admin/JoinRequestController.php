<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\LiveJoinRequest;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class JoinRequestController extends Controller
{
    public function index(int $course): JsonResponse
    {
        $rows = LiveJoinRequest::query()
            ->where('course_id', $course)
            ->where('status', 'pending')
            ->where('created_at', '>', now()->subHours(2))
            ->orderBy('created_at')
            ->limit(100)
            ->get(['id', 'name', 'created_at']);

        return response()->json(['data' => $rows]);
    }

    public function decide(Request $request, int $course, int $id, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate(['admit' => ['required', 'boolean']]);

        $req = LiveJoinRequest::query()->where('course_id', $course)->where('id', $id)->firstOrFail();

        if ($req->status !== 'pending') {
            return response()->json(['data' => ['id' => $req->id, 'status' => $req->status]]);
        }

        $req->forceFill([
            'status' => $data['admit'] ? 'admitted' : 'denied',
            'decided_at' => now(),
        ])->save();

        $model = Course::query()->findOrFail($course);
        $activity->log($request->user(), $data['admit'] ? 'live.guest_admitted' : 'live.guest_denied', $model, [
            'request_id' => $req->id,
            'name' => $req->name,
        ]);

        return response()->json(['data' => ['id' => $req->id, 'status' => $req->status]]);
    }

    public function admitAll(Request $request, int $course, ActivityLogger $activity): JsonResponse
    {
        $count = LiveJoinRequest::query()
            ->where('course_id', $course)
            ->where('status', 'pending')
            ->where('created_at', '>', now()->subHours(2))
            ->update(['status' => 'admitted', 'decided_at' => now()]);

        $model = Course::query()->findOrFail($course);
        $activity->log($request->user(), 'live.guests_admitted_all', $model, ['count' => $count]);

        return response()->json(['data' => ['admitted' => $count]]);
    }
}