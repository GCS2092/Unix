<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CourseAccessGrantedNotification extends Notification
{
    public function __construct(private readonly string $courseTitle, private readonly string $url)
    {
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return LiveInvitationNotification::mailReady() ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Accès activé : '.$this->courseTitle)
            ->greeting('Bonjour,')
            ->line('Votre paiement est confirmé : vous avez maintenant accès à « '.$this->courseTitle.' ».')
            ->action('Commencer la formation', $this->url);
    }
}