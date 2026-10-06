<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

class LiveSessionNotification extends Notification
{
    public function __construct(
        private readonly int $courseId,
        private readonly string $courseTitle,
        private readonly string $path,
        private readonly string $url,
        private readonly string $startsAt,
        private readonly ?string $title = null,
        private readonly ?string $note = null,
        private readonly bool $reminder = false,
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
            'type' => $this->reminder ? 'live_reminder' : 'live_scheduled',
            'course_id' => $this->courseId,
            'course_title' => $this->courseTitle,
            'path' => $this->path,
            'guest' => false,
            'note' => $this->note,
            'invited_by' => null,
            'starts_at' => $this->startsAt,
            'session_title' => $this->title,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $when = Carbon::parse($this->startsAt)->timezone(config('app.timezone'))->format('d/m/Y à H:i T');
        $label = $this->title ?: $this->courseTitle;

        $mail = (new MailMessage)
            ->subject(($this->reminder ? 'Rappel : ' : 'Séance planifiée : ').$label)
            ->greeting('Bonjour,')
            ->line($this->reminder
                ? 'La session « '.$label.' » commence bientôt ('.$when.').'
                : 'Une session en direct est prévue : « '.$label.' », le '.$when.'.');

        if ($this->note !== null && trim($this->note) !== '') {
            $mail->line($this->note);
        }

        return $mail->action('Accéder à la session', $this->url);
    }
}