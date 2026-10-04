<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsStudent
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || (! $user->is_student && ! $user->is_admin)) {
            abort(Response::HTTP_FORBIDDEN, 'Accès réservé aux étudiants.');
        }

        return $next($request);
    }
}