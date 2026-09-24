<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\OptionalSanctumAuth;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'sanctum.optional' => OptionalSanctumAuth::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Toute exception non geree explicitement ailleurs est journalisee
        // avec son contexte, puis renvoyee au client sous une forme propre
        // et sans detail technique interne (jamais de stack trace exposee).
        $exceptions->render(function (Throwable $e, Request $request) {
            // Laravel sait deja produire un 401 / 422 JSON propre pour ces cas
            if ($e instanceof AuthenticationException
                || $e instanceof ValidationException) {
                return null;
            }
            if (! $request->expectsJson() && ! $request->is('api/*')) {
                return null; // laisse Laravel gerer les routes web normalement
            }

            $status = $e instanceof HttpExceptionInterface
                ? $e->getStatusCode()
                : 500;

            if ($status >= 500) {
                Log::error('Exception non geree', [
                    'message' => $e->getMessage(),
                    'exception' => $e::class,
                    'url' => $request->fullUrl(),
                    'method' => $request->method(),
                ]);
            }

            $message = $status >= 500
                ? 'Une erreur inattendue est survenue. Notre equipe a ete alertee.'
                : $e->getMessage();

            return response()->json(['message' => $message], $status);
        });
    })->create();
