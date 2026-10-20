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
                'decision_note' => $r->decision_note,
                'decided_at' => $r->decided_at,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function decide(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['action' => ['required', 'in:approve,reject'], 'note' => ['nullable', 'string', 'max:300']]);

        $result = DB::transaction(function () use ($id, $data, $request) {
            $req = EnrollmentRequest::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($req->status !== 'pending') {
                return null;
            }
            $approve = $data['action'] === 'approve';
            if ($approve) {
                Enrollment::firstOrCreate(
                    ['user_id' => $req->user_id, 'course_id' => $req->course_id],
                    ['progress' => 0],
                );
                $user = $req->user;
                $user->is_student = true;
                $user->save();
            }
            $req->update([
                'status' => $approve ? 'approved' : 'rejected',
                'decided_by' => $request->user()->id,
                'decision_note' => $data['note'] ?? null,
                'decided_at' => now(),
            ]);

            return $req;
        });

        if ($result === null) {
            return response()->json(['message' => 'Cette demande a déjà été traitée.'], 422);
        }
        $req = $result;

        try {
            app(\App\Services\ActivityLogger::class)->log($request->user(), 'enrollment_request.decided', $req, [
                'action' => $data['action'],
                'user_id' => $req->user_id,
                'course_id' => $req->course_id,
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        try {
            $req->loadMissing(['user', 'course']);
            if ($req->user !== null && $req->course !== null) {
                $approved = $data['action'] === 'approve';
                $enr = $approved ? Enrollment::where('user_id', $req->user_id)->where('course_id', $req->course_id)->first() : null;
                $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
                $url = $enr ? $base.'/etudiant/cours/'.$enr->id : $base.'/formations/'.$req->course->slug;
                $req->user->notify(new \App\Notifications\EnrollmentDecisionNotification((string) $req->course->title, $approved, $url, $data['note'] ?? null));
            }
        } catch (\Throwable $e) {
            report($e); // la decision reste valide meme si l'e-mail echoue
        }

        return response()->json(['data' => ['id' => $req->id, 'status' => $req->status]]);
    }
}
