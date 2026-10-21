<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class CourseCoverController extends Controller
{
    public function media(string $name): Response
    {
        abort_unless(preg_match('/^[A-Za-z0-9._-]+$/', $name) === 1, 404);
        $path = 'course-covers/'.$name;
        $disk = Storage::disk('public');
        abort_unless($disk->exists($path), 404);

        return $disk->response($path, null, ['Cache-Control' => 'public, max-age=86400']);
    }
}