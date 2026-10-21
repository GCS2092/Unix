<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Presentation;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class PresentationController extends Controller
{
    public function show(string $space): JsonResponse
    {
        $content = Presentation::forSpace($space);
        if (! $content['published']) {
            abort(404);
        }

        return response()->json(['data' => Presentation::present($content)]);
    }

    public function media(string $name): Response
    {
        abort_unless(preg_match('/^[A-Za-z0-9._-]+$/', $name) === 1, 404);
        $path = 'presentations/'.$name;
        $disk = \App\Support\MediaDisk::disk();
        abort_unless($disk->exists($path), 404);

        return $disk->response($path, null, ['Cache-Control' => 'public, max-age=86400']);
    }
}