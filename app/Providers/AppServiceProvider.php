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
            app(\App\Services\ShopSettings::class)->apply();
        } catch (\Throwable) {
            // valeurs par defaut de config/shipping.php
        }

        // Lien et e-mail de reinitialisation : IGA pour un compte formation seul, BETCC sinon
        $resetUrl = function ($user, string $token): string {
            $base = rtrim((string) config('app.frontend_url'), '/');
            $query = http_build_query(['token' => $token, 'email' => $user->getEmailForPasswordReset()]);
            if ($user instanceof \App\Models\User && $user->isFormationSignup()) {
                return $base.'/etudiant/mot-de-passe/reinitialiser?'.$query;
            }
            $portal = $user->is_student && ! $user->is_admin ? 'portail=etudiant&' : '';

            return $base.'/mot-de-passe/reinitialiser?'.$portal.$query;
        };
        ResetPassword::createUrlUsing($resetUrl);
        ResetPassword::toMailUsing(function ($notifiable, string $token) use ($resetUrl) {
            if ($notifiable instanceof \App\Models\User && $notifiable->isFormationSignup()) {
                \App\Support\Brand::useSpace('formation');
            }
            $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');

            return (new \Illuminate\Notifications\Messages\MailMessage)
                ->subject(\Illuminate\Support\Facades\Lang::get('Reset Password Notification'))
                ->line(\Illuminate\Support\Facades\Lang::get('You are receiving this email because we received a password reset request for your account.'))
                ->action(\Illuminate\Support\Facades\Lang::get('Reset Password'), $resetUrl($notifiable, $token))
                ->line(\Illuminate\Support\Facades\Lang::get('This password reset link will expire in :count minutes.', ['count' => $minutes]))
                ->line(\Illuminate\Support\Facades\Lang::get('If you did not request a password reset, no further action is required.'));
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