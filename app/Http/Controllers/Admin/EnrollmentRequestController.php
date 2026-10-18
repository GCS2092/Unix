<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\EnrollmentRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EnrollmentRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pending');

        $rows = EnrollmentRequest::with(['user:id,name,email,phone', 'course:id,title'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->latest()
            ->limit(100)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'status' => $r->status,
                'message' => $r->message,
                'created_at' => $r->created_at,
                'user_name' => $r->user?->name,
                'user_email' => $r->user?->email,
                'user_phone' => $r->user?->phone,
                'course_id' => $r->course_id,
                'course_title' => $r->course?->title,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function decide(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['action' => ['required', 'in:approve,reject']]);

        $req = EnrollmentRequest::findOrFail($id);
        if ($req->status !== 'pending') {
            return response()->json(['message' => 'Cette demande a déjà été traitée.'], 422);
        }

        DB::transaction(function () use ($req, $data, $request): void {
            if ($data['action'] === 'approve') {
                Enrollment::firstOrCreate(['user_id' => $req->user_id, 'course_id' => $req->course_id]);
                $req->user()->update(['is_student' => true]);
            }
            $req->update([
                'status' => $data['action'] === 'approve' ? 'approved' : 'rejected',
                'decided_by' => $request->user()->id,
                'decided_at' => now(),
            ]);
        });

        return response()->json(['data' => ['id' => $req->id, 'status' => $req->status]]);
    }
}
