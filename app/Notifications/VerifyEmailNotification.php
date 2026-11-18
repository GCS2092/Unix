<?php

namespace App\Notifications;

use App\Models\EmailVerificationCode;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends Notification
{
    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /** Ancien lien signe (GET), valable 24 h : conserve pour les e-mails deja envoyes. */
    public static function urlFor(User $user): string
    {
        return URL::temporarySignedRoute('api.v1.auth.verify-email', now()->addHours(24), [
            'id' => $user->id,
            'hash' => sha1(strtolower((string) $user->email)),
        ]);
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($notifiable instanceof User && $notifiable->isFormationSignup()) {
            \App\Support\Brand::useSpace('formation');
        }
        $en = app()->getLocale() === 'en';
        ['code' => $code, 'token' => $token] = EmailVerificationCode::issue($notifiable);

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $url = $base.'/verification-email?u='.$notifiable->id.'&t='.$token;

        return (new MailMessage)
            ->subject(__('verify.subject'))
            ->view('emails.verify-code', [
                'code' => $code,
                'url' => $url,
                'minutes' => EmailVerificationCode::CODE_MINUTES,
                'en' => $en,
                'name' => (string) ($notifiable->name ?? ''),
            ]);
    }
}