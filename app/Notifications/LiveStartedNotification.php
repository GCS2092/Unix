<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class LiveStartedNotification extends Notification
{
    public function __construct(
        private readonly int $courseId,
        private readonly string $courseTitle,
        private readonly string $path,
        private readonly string $url,
    ) {
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return LiveInvitationNotification::mailReady() ? ['database', 'mail'] : ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'live_started',
            'course_id' => $this->courseId,
            'course_title' => $this->courseTitle,
            'path' => $this->path,
            'guest' => false,
            'note' => null,
            'invited_by' => null,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Le direct a commencé : '.$this->courseTitle)
            ->greeting('Bonjour,')
            ->line('La session en direct « '.$this->courseTitle.' » vient de commencer.')
            ->action('Rejoindre maintenant', $this->url);
    }
}