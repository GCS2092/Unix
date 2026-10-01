<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $logs = ActivityLog::query()
            ->with('user:id,name,email')
            ->when($q !== '', fn ($w) => $w->where('action', 'like', '%'.addcslashes($q, '%_\\').'%'))
            ->latest('id')
            ->paginate(30);

        return response()->json([
            'data' => $logs->getCollection()->map(fn (ActivityLog $l) => [
                'id' => $l->id,
                'action' => $l->action,
                'user_name' => $l->user?->name,
                'user_email' => $l->user?->email,
                'subject_type' => $l->subject_type ? class_basename($l->subject_type) : null,
                'subject_id' => $l->subject_id,
                'metadata' => $l->metadata,
                'created_at' => $l->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}