<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\LiveSession;
use App\Notifications\LiveSessionNotification;
use App\Services\ActivityLogger;
use App\Services\LiveAudience;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class LiveSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $courseId = $request->integer('course_id');

        $query = LiveSession::query()
            ->with('course:id,title')
            ->where('starts_at', '>=', now()->subHours(2))
            ->orderBy('starts_at')
            ->limit(100);

        if ($courseId) {
            $query->where('course_id', $courseId);
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

    public function store(Request $request, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'title' => ['nullable', 'string', 'max:120'],
            'starts_at' => ['required', 'date', 'after:now'],
            'note' => ['nullable', 'string', 'max:500'],
            'notify' => ['sometimes', 'boolean'],
        ]);

        $course = Course::query()->findOrFail($data['course_id']);

        $session = LiveSession::query()->create([
            'course_id' => $course->id,
            'title' => $data['title'] ?? null,
            'starts_at' => Carbon::parse($data['starts_at']),
            'note' => $data['note'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        $notified = 0;

        if ($data['notify'] ?? false) {
            if ($course->invite_token === null) {
                $course->forceFill(['invite_token' => Str::random(40)])->save();
            }

            $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

            foreach (LiveAudience::recipients($course, (int) $request->user()->id) as $r) {
                try {
                    $r['user']->notify(new LiveSessionNotification(
                        $course->id,
                        (string) $course->title,
                        $r['path'],
                        $base.$r['path'],
                        $session->starts_at->toIso8601String(),
                        $session->title,
                        $session->note,
                    ));
                    $notified++;
                } catch (\Throwable $e) {
                    Log::warning('Annonce de seance echouee (user '.$r['user']->id.') : '.$e->getMessage());
                }
            }
        }

        $activity->log($request->user(), 'live.session_planned', $course, ['session_id' => $session->id, 'notified' => $notified]);

        return response()->json(['data' => ['id' => $session->id, 'notified' => $notified]]);
    }

    public function destroy(Request $request, int $id, ActivityLogger $activity): JsonResponse
    {
        $session = LiveSession::query()->with('course')->findOrFail($id);
        $course = $session->course;
        $session->delete();

        if ($course !== null) {
            $activity->log($request->user(), 'live.session_deleted', $course, ['session_id' => $id]);
        }

        return response()->json(['data' => ['id' => $id]]);
    }
}