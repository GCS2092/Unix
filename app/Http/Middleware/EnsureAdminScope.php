<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminScope
{
    public function handle(Request $request, Closure $next, string $scope): Response
    {
        $user = $request->user();
        if (! $user || ! $user->hasAdminScope($scope)) {
            abort(Response::HTTP_FORBIDDEN, 'Accès non autorisé pour cet espace d\'administration.');
        }

        return $next($request);
    }
}