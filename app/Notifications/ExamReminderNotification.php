<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ExamReminderNotification extends Notification
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
            ->subject('Dernière étape : passez votre examen — '.$this->courseTitle)
            ->greeting('Bonjour,')
            ->line('Vous avez terminé la vidéo de « '.$this->courseTitle.' ». Il ne reste que l\'examen final pour obtenir votre certificat.')
            ->action('Passer l\'examen', $this->url);
    }
}