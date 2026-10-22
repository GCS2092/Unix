<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** E-mail envoye a l'eleve avec son certificat en piece jointe (PDF). Envoi immediat, non mis en file. */
class CertificateDeliveredNotification extends Notification
{
    public function __construct(
        private readonly string $courseTitle,
        private readonly string $pdf,
        private readonly string $filename,
        private readonly string $code,
        private readonly string $verifyUrl,
    ) {
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Votre certificat : '.$this->courseTitle)
            ->greeting('Bonjour '.($notifiable->name ?? '').',')
            ->line('Félicitations ! Votre certificat de réussite pour la formation « '.$this->courseTitle.' » est joint à ce message (PDF).')
            ->line('Code de vérification : '.$this->code)
            ->action("Vérifier l'authenticité", $this->verifyUrl)
            ->line('Conservez ce fichier. Vous pouvez aussi le télécharger depuis votre espace étudiant.')
            ->attachData($this->pdf, $this->filename, ['mime' => 'application/pdf']);
    }
}