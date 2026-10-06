<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Services\ActivityLogger;
use App\Services\LiveKitRoomAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class EnrollmentRemovalController extends Controller
{
    public function destroy(Request $request, int $id, ActivityLogger $activity, LiveKitRoomAdmin $rooms): JsonResponse
    {
        $enrollment = Enrollment::query()->findOrFail($id);
        $course = Course::query()->find($enrollment->course_id);
        $userId = (int) $enrollment->user_id;

        // Garde-fou : on ne supprime pas une inscription qui a deja donne lieu a un certificat
        if (Schema::hasTable('certificates')
            && Schema::hasColumn('certificates', 'enrollment_id')
            && DB::table('certificates')->where('enrollment_id', $enrollment->id)->exists()) {
            return response()->json([
                'message' => 'Un certificat a déjà été émis pour cette inscription : elle ne peut pas être retirée.',
            ], 422);
        }

        try {
            $enrollment->delete();
        } catch (\Throwable $e) {
            Log::warning('Retrait d\'inscription impossible (#'.$id.') : '.$e->getMessage());

            return response()->json([
                'message' => 'Impossible de retirer cette inscription (des données y sont liées).',
            ], 409);
        }

        // Si l'eleve est dans le direct en ce moment, on l'en retire
        if ($course !== null && (bool) $course->is_live && (string) $course->livekit_room !== '') {
            try {
                $rooms->remove((string) $course->livekit_room, 'user-'.$userId);
            } catch (\Throwable $e) {
                Log::warning('Expulsion du direct impossible (user '.$userId.') : '.$e->getMessage());
            }
        }

        if ($course !== null) {
            $activity->log($request->user(), 'enrollment.removed', $course, [
                'enrollment_id' => $id,
                'user_id' => $userId,
            ]);
        }

        return response()->json(['data' => ['id' => $id]]);
    }
}