<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Presentation;
use Illuminate\Http\JsonResponse;

class PresentationController extends Controller
{
    public function show(string $space): JsonResponse
    {
        $content = Presentation::forSpace($space);
        if (! $content['published']) {
            abort(404);
        }

        return response()->json(['data' => $content]);
    }
}