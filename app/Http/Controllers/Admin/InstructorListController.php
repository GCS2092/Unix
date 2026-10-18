<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class InstructorListController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $rows = User::query()
            ->where('is_admin', true)
            ->where('admin_scope', 'instructor')
            ->where('is_blocked', false)
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return response()->json(['data' => $rows]);
    }
}
