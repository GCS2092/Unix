<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogger;
use App\Support\SiteInfo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SiteInfoController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => SiteInfo::all()]);
    }

    public function update(Request $request, ActivityLogger $activity): JsonResponse
    {
        $data = $request->validate(SiteInfo::rules());
        $before = SiteInfo::all();
        SiteInfo::save($data);
        $activity->log($request->user(), 'settings.site_info_updated', null, ['before' => $before, 'after' => SiteInfo::all()]);

        return response()->json(['data' => SiteInfo::all()]);
    }
}