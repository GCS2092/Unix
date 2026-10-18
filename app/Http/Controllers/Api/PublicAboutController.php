<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AboutSettings;
use Illuminate\Http\JsonResponse;

class PublicAboutController extends Controller
{
    public function show(AboutSettings $about): JsonResponse
    {
        return response()->json(['data' => $about->all()]);
    }
}