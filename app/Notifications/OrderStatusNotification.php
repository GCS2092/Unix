<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrderStatusNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Order $order, public readonly string $step)
    {
        // La langue du client est conservee meme quand l'envoi se fait en file
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
        $key = $this->step === 'delivered' && $order->delivery_method === 'pickup' ? 'picked_up' : $this->step;

        $mail = (new MailMessage)
            ->subject(__("tracking.$key.subject", ['id' => $order->id]))
            ->greeting(__('tracking.greeting'))
            ->line(__("tracking.$key.line", ['id' => $order->id]));

        if ($order->delivery_method === 'delivery' && $this->step === 'shipped') {
            $address = trim(implode(', ', array_filter([$order->address, $order->district, $order->city])));
            if ($address !== '') {
                $mail->line(__('tracking.address', ['address' => $address]));
            }
            if ($order->carrier) {
                $mail->line(__('tracking.carrier', ['carrier' => $order->carrier]));
            }
            if ($order->tracking_number) {
                $mail->line(__('tracking.number', ['number' => $order->tracking_number]));
            }
        }

        if ($order->delivery_method === 'pickup' && $this->step === 'ready' && $order->pickup_note) {
            $mail->line(__('tracking.pickup', ['place' => $order->pickup_note]));
        }

        $mail
            ->action(__('tracking.action'), $order->trackingUrl($notifiable instanceof AnonymousNotifiable))
            ->line(__('tracking.thanks'));

        return $mail;
    }
}