<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ImportRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImportRunController extends Controller
{
    public function show(Request $request, ImportRun $run): JsonResponse
    {
        $u = $request->user();
        abort_unless($run->user_id === $u->id || ($u->admin_scope ?? 'super') === 'super', 403);

        return response()->json(['data' => [
            'status' => $run->status,
            'report' => $run->status === 'done' ? $run->report : null,
            'error' => $run->error,
        ]]);
    }
}