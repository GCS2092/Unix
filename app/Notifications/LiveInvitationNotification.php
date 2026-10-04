<?php

namespace App\Notifications;

use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LiveInvitationNotification extends Notification
{
    public function __construct(
        private readonly int $courseId,
        private readonly string $courseTitle,
        private readonly string $path,
        private readonly string $url,
        private readonly bool $guest,
        private readonly ?string $note = null,
        private readonly ?string $invitedBy = null,
    ) {
    }

    /** Vrai si un vrai service d'envoi d'e-mails est configure. */
    public static function mailReady(): bool
    {
        return ! in_array(config('mail.default'), ['log', 'array'], true);
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        if ($notifiable instanceof AnonymousNotifiable) {
            return ['mail'];
        }

        return self::mailReady() ? ['database', 'mail'] : ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'live_invitation',
            'course_id' => $this->courseId,
            'course_title' => $this->courseTitle,
            'path' => $this->path,
            'guest' => $this->guest,
            'note' => $this->note,
            'invited_by' => $this->invitedBy,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('Invitation à une session en direct : '.$this->courseTitle)
            ->greeting('Bonjour,')
            ->line('Vous êtes invité(e) à rejoindre la session en direct « '.$this->courseTitle.' ».');

        if ($this->note !== null && trim($this->note) !== '') {
            $mail->line($this->note);
        }

        return $mail
            ->action('Rejoindre la session', $this->url)
            ->line($this->guest
                ? "Aucun compte n'est nécessaire : saisissez simplement votre nom."
                : "Connectez-vous à votre espace étudiant si le site vous le demande.")
            ->line("La session s'ouvre lorsque le formateur la démarre.");
    }
}