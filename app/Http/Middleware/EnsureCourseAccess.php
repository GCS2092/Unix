<?php

namespace App\Http\Middleware;

use App\Models\Course;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Un formateur ne peut agir que sur les cours dont il est propriétaire. */
class EnsureCourseAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $param = $request->route('course');

        if ($user && $user->isInstructorOnly() && $param !== null) {
            $course = $param instanceof Course
                ? $param
                : (ctype_digit((string) $param)
                    ? Course::query()->find((int) $param)
                    : Course::query()->where('slug', (string) $param)->first());

            // Cours introuvable : le contrôleur répondra 404
            if ($course !== null && ! $course->canBeManagedBy($user)) {
                abort(Response::HTTP_FORBIDDEN, 'Ce cours ne vous est pas attribué.');
            }
        }

        return $next($request);
    }
}
