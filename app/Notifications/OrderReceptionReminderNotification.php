<?php

namespace App\Notifications;

use App\Models\Order;
use App\Services\CommunicationSettings;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrderReceptionReminderNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Order $order)
    {
        $this->locale($order->locale ?: 'fr');
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
        $order = $this->order;
        $settings = app(CommunicationSettings::class);
        $guest = $notifiable instanceof AnonymousNotifiable || $order->user_id === null;
        $ref = $order->public_ref ?: '#'.$order->id;

        $mail = (new MailMessage)
            ->subject(__('reminder.subject', ['ref' => $ref]))
            ->greeting(__('reminder.greeting'))
            ->line(__('reminder.line', ['ref' => $ref]))
            ->line(__('reminder.how'))
            ->action(__('reminder.action'), $order->trackingUrl($guest));

        $contact = implode(' / ', array_filter([(string) $settings->get('support_email'), (string) $settings->get('support_whatsapp')]));
        if ($contact !== '') {
            $mail->line(__('reminder.problem', ['contact' => $contact]));
        }

        return $mail->line(__('reminder.thanks'));
    }
}