<?php

namespace App\Notifications;

use App\Models\Course;
use App\Models\Order;
use App\Models\Product;
use App\Services\CommunicationSettings;
use App\Services\InvoiceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class OrderPaidNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly Order $order)
    {
        // La langue du client est conservee meme quand l'envoi se fait en file (webhook)
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
        $order = $this->order->loadMissing('items.itemable');
        $settings = app(CommunicationSettings::class);
        $guest = $notifiable instanceof AnonymousNotifiable;
        $ref = $order->public_ref ?: '#'.$order->id;
        $url = $order->trackingUrl($guest);

        $mail = (new MailMessage)
            ->subject(__('mail.paid.subject', ['ref' => $ref]))
            ->greeting(__('mail.paid.greeting'))
            ->line(__('mail.paid.intro'))
            ->line(__('mail.paid.reference', ['ref' => '**'.$ref.'**']));

        if ($guest) {
            $mail->line(__('mail.confirm.keep_ref'));
        }

        foreach ($order->items as $item) {
            $model = $item->itemable;
            $name = match (true) {
                $model instanceof Product => $model->localizedName(),
                $model instanceof Course => $model->title,
                default => __('mail.paid.item'),
            };
            $mail->line("\u{2022} ".$name." \u{00D7} ".$item->quantity." \u{2014} ".$this->money($item->line_total, $order->currency));
        }

        if ($order->delivery_method === 'delivery') {
            $mail->line(__('mail.paid.delivery', ['address' => trim(implode(', ', array_filter([$order->address, $order->district, $order->city])))]));
        } elseif ($order->delivery_method === 'pickup') {
            $mail->line(__('mail.paid.pickup'));
            $place = $order->pickup_note ?: (string) $settings->get('pickup_place');
            if ($place !== '') {
                $mail->line(__('mail.confirm.pickup_place', ['place' => $place]));
            }
            if (($hours = (string) $settings->get('pickup_hours')) !== '') {
                $mail->line(__('mail.confirm.pickup_hours', ['hours' => $hours]));
            }
            if (($what = (string) $settings->get('pickup_requirements')) !== '') {
                $mail->line(__('mail.confirm.pickup_requirements', ['what' => $what]));
            }
        }

        $mail->line(__('mail.paid.total', ['amount' => $this->money($order->total, $order->currency)]));

        if (in_array($order->delivery_method, ['delivery', 'pickup'], true)) {
            $mail->line('**'.__('mail.confirm.next_title').'**')
                ->line(__($order->delivery_method === 'pickup' ? 'mail.confirm.next_pickup' : 'mail.confirm.next_delivery'));
            $days = (int) $settings->get('prep_days');
            if ($days > 0) {
                $mail->line(__('mail.confirm.next_prep', ['days' => $days]));
            }
        }

        $mail->action(__($guest ? 'mail.paid.action_guest' : 'mail.paid.action'), $url);

        if ($guest) {
            $mail->line(__('mail.confirm.fallback_link', ['url' => $url]))
                ->line(__('mail.confirm.private_link'));
        }

        if ($settings->get('attach_invoice')) {
            try {
                $mail->attachData(
                    $this->invoicePdf($order),
                    $this->invoiceFilename($order),
                    ['mime' => 'application/pdf'],
                );
                $mail->line(__('mail.confirm.invoice'));
            } catch (\Throwable $e) {
                report($e); // un echec de PDF ne doit jamais bloquer l'e-mail de confirmation
            }
        }

        if ($guest && $settings->get('invite_account_cta')) {
            $mail->line(__('mail.confirm.create_account'));
        }

        $custom = $settings->localized('message', $order->locale ?: 'fr');
        if ($custom !== '') {
            $mail->line($custom);
        }

        $contact = implode(' / ', array_filter([(string) $settings->get('support_email'), (string) $settings->get('support_whatsapp')]));
        if ($contact !== '') {
            $mail->line(__('mail.confirm.help', ['contact' => $contact, 'ref' => $ref]));
        }

        return $mail->line(__('mail.paid.thanks'));
    }

    private function invoicePdf(Order $order): string
    {
        $service = app(InvoiceService::class);
        $invoice = \App\Models\Invoice::query()->where('order_id', $order->id)->first();

        return $invoice ? $service->outputInvoice($invoice) : $service->output($order);
    }

    private function invoiceFilename(Order $order): string
    {
        $number = \App\Models\Invoice::query()->where('order_id', $order->id)->value('number');

        return ($number ?? 'facture-'.$order->id).'.pdf';
    }

    private function money(int $amount, string $currency): string
    {
        return number_format($amount, 0, ',', ' ').' '.($currency === 'XOF' ? 'FCFA' : $currency);
    }
}