<?php

namespace App\Notifications;

use App\Models\Order;
use App\Services\CommunicationSettings;
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
        $settings = app(CommunicationSettings::class);
        // Le lien depend de la commande (rattachee a un compte ou non), pas du type de destinataire
        $guest = $notifiable instanceof AnonymousNotifiable || $order->user_id === null;
        $ref = $order->public_ref ?: '#'.$order->id;
        $url = $order->trackingUrl($guest);
        $key = $this->step === 'delivered' && $order->delivery_method === 'pickup' ? 'picked_up' : $this->step;

        $mail = (new MailMessage)
            ->subject(__("tracking.$key.subject", ['ref' => $ref]))
            ->greeting(__('tracking.greeting'))
            ->line(__("tracking.$key.line", ['ref' => $ref]));

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

        if ($order->delivery_method === 'pickup' && $this->step === 'ready') {
            $place = $order->pickup_note ?: (string) $settings->get('pickup_place');
            if ($place !== '') {
                $mail->line(__('tracking.pickup', ['place' => $place]));
            }
            if (($hours = (string) $settings->get('pickup_hours')) !== '') {
                $mail->line(__('tracking.hours', ['hours' => $hours]));
            }
            if (($what = (string) $settings->get('pickup_requirements')) !== '') {
                $mail->line(__('tracking.bring', ['what' => $what]));
            }
            $mail->line(__('tracking.bring_ref', ['ref' => $ref]));
        }

        if ($this->step === 'delivered' && $order->warranty_months) {
            $mail->line(__('tracking.warranty', ['months' => $order->warranty_months]));
        }

        $mail->action(__('tracking.action'), $url);

        if ($guest) {
            $mail->line(__('mail.confirm.fallback_link', ['url' => $url]));
        }

        $custom = $settings->localized('message', $order->locale ?: 'fr');
        if ($custom !== '') {
            $mail->line($custom);
        }

        $contact = implode(' / ', array_filter([(string) $settings->get('support_email'), (string) $settings->get('support_whatsapp')]));
        if ($contact !== '') {
            $mail->line(__('tracking.help', ['contact' => $contact, 'ref' => $ref]));
        }

        return $mail->line(__('tracking.thanks'));
    }
}