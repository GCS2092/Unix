<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\SiteInfo;
use Illuminate\Http\JsonResponse;

class PublicSiteInfoController extends Controller
{
    public function show(): JsonResponse
    {
        return response()
            ->json(['data' => SiteInfo::all(true)])
            ->header('Cache-Control', 'public, max-age=60');
    }
}