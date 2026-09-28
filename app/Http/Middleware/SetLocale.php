<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SetLocale
{
    public function handle(Request $request, Closure $next)
    {
        $lang = substr((string) $request->header('Accept-Language', 'fr'), 0, 2);
        app()->setLocale(in_array($lang, ['fr', 'en'], true) ? $lang : 'fr');

        return $next($request);
    }
}