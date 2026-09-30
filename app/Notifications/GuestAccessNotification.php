<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class GuestAccessNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $token,
        public readonly string $email,
        ?string $locale = null,
    ) {
        $this->locale($locale ?: 'fr');
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = rtrim(config('app.frontend_url'), '/').'/mot-de-passe/reinitialiser?'
            .http_build_query(['token' => $this->token, 'email' => $this->email]);

        return (new MailMessage)
            ->subject(__('mail.guest.subject'))
            ->greeting(__('mail.guest.greeting'))
            ->line(__('mail.guest.intro'))
            ->action(__('mail.guest.action'), $url)
            ->line(__('mail.guest.expire'));
    }
}