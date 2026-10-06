<?php

namespace App\Providers;

use App\Models\Order;
use App\Policies\OrderPolicy;
use App\Services\SettingsService;
use Illuminate\Auth\Notifications\ResetPassword;
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

        // Reglages modifiables depuis l'admin (frais de livraison, seuil de stock).
        // Dashboard admin : invalider le cache quand les chiffres changent
        $bump = fn () => \Illuminate\Support\Facades\Cache::forever(
            'admin.dashboard.version',
            (int) \Illuminate\Support\Facades\Cache::get('admin.dashboard.version', 1) + 1
        );
        Order::saved($bump);
        \App\Models\Product::saved($bump);

        // Silencieux si la table n'existe pas encore (avant `php artisan migrate`).
        try {
            app(SettingsService::class)->apply();
        } catch (\Throwable) {
            // valeurs par defaut de config/shipping.php
        }

        // Le lien de reinitialisation ouvre la page du front, pas une route Laravel
        ResetPassword::createUrlUsing(function ($user, string $token) {
            return rtrim(config('app.frontend_url'), '/').'/mot-de-passe/reinitialiser?'.($user->is_student && ! $user->is_admin ? 'portail=etudiant&' : '')
                .http_build_query(['token' => $token, 'email' => $user->getEmailForPasswordReset()]);
        });

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