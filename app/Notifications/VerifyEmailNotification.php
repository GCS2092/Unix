<?php

namespace App\Notifications;

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

    /** Lien signe, valable 24 h, lie a l'adresse e-mail actuelle du compte. */
    public static function urlFor(User $user): string
    {
        return URL::temporarySignedRoute('api.v1.auth.verify-email', now()->addHours(24), [
            'id' => $user->id,
            'hash' => sha1(strtolower((string) $user->email)),
        ]);
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('verify.subject'))
            ->greeting(__('verify.greeting'))
            ->line(__('verify.line'))
            ->action(__('verify.action'), self::urlFor($notifiable))
            ->line(__('verify.expire'))
            ->line(__('verify.ignore'));
    }
}