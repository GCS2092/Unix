<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class StalledReminderNotification extends Notification
{
    public function __construct(
        private readonly string $courseTitle,
        private readonly int $progress,
        private readonly string $url,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return LiveInvitationNotification::mailReady() ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Reprenez votre formation : '.$this->courseTitle)
            ->greeting('Bonjour,')
            ->line("Vous n'avez pas avancé sur « ".$this->courseTitle." » depuis un moment (progression : ".$this->progress." %).")
            ->line('Reprenez quand vous voulez : votre progression est conservée.')
            ->action('Reprendre ma formation', $this->url);
    }
}