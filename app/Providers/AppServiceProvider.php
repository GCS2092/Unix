<?php

namespace App\Providers;

use App\Models\Order;
use App\Policies\OrderPolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::policy(Order::class, OrderPolicy::class);

        // Limite les tentatives de connexion / mot de passe oublie par
        // combinaison email + IP, pour ralentir le brute-force sans
        // bloquer un utilisateur legitime partageant son IP avec d'autres.
        RateLimiter::for('auth-attempts', function ($request) {
            $email = (string) $request->input('email', '');

            return Limit::perMinute(5)->by($email.'|'.$request->ip());
        });

        // Limite generale sur le webhook CinetPay, pour eviter le spam
        // ou l'abus de quota sur l'appel de verification aupres de CinetPay.
        RateLimiter::for('cinetpay-webhook', function ($request) {
            return Limit::perMinute(60)->by($request->ip());
        });
    }
}
