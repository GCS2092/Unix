<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class EnrollmentDecisionNotification extends Notification
{
    public function __construct(
        private readonly string $courseTitle,
        private readonly bool $approved,
        private readonly string $url,
        private readonly ?string $note = null,
    ) {
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return LiveInvitationNotification::mailReady() ? ['mail'] : [];
    }

    public function toMail(object $notifiable): MailMessage
    {
        if ($this->approved) {
            return (new MailMessage)
                ->subject('Inscription acceptée : '.$this->courseTitle)
                ->greeting('Bonjour,')
                ->line('Votre demande d\'accès à « '.$this->courseTitle.' » a été acceptée.')
                ->action('Commencer la formation', $this->url);
        }

        $mail = (new MailMessage)
            ->subject('Votre demande : '.$this->courseTitle)
            ->greeting('Bonjour,')
            ->line('Votre demande d\'accès à « '.$this->courseTitle.' » n\'a pas pu être acceptée pour le moment.');

        if ($this->note !== null && $this->note !== '') {
            $mail->line('Motif : '.$this->note);
        }

        return $mail->line('Vous pouvez refaire une demande depuis la page de la formation.')
            ->action('Voir la formation', $this->url);
    }
}