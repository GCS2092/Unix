<?php

namespace App\Notifications;

use App\Models\Course;
use App\Models\Order;
use App\Models\Product;
use App\Services\InvoiceService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
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

        $mail = (new MailMessage)
            ->subject(__('mail.paid.subject', ['id' => $order->id]))
            ->greeting(__('mail.paid.greeting'))
            ->line(__('mail.paid.intro'));

        foreach ($order->items as $item) {
            $model = $item->itemable;
            $name = match (true) {
                $model instanceof Product => $model->localizedName(),
                $model instanceof Course => $model->title,
                default => __('mail.paid.item'),
            };
            $mail->line('• '.$name.' × '.$item->quantity.' — '.$this->money($item->line_total, $order->currency));
        }

        if ($order->delivery_method === 'delivery') {
            $mail->line(__('mail.paid.delivery', ['address' => trim(implode(', ', array_filter([$order->address, $order->district, $order->city])))]));
        } elseif ($order->delivery_method === 'pickup') {
            $mail->line(__('mail.paid.pickup'));
        }

        $mail
            ->line(__('mail.paid.total', ['amount' => $this->money($order->total, $order->currency)]))
            ->when(! $notifiable instanceof \Illuminate\Notifications\AnonymousNotifiable, fn ($m) => $m->action(__('mail.paid.action'), rtrim(config('app.frontend_url'), '/').'/commandes'))
            ->line(__('mail.paid.thanks'));

        try {
            $mail->attachData(
                $this->invoicePdf($order),
                $this->invoiceFilename($order),
                ['mime' => 'application/pdf'],
            );
        } catch (\Throwable $e) {
            report($e); // un échec de PDF ne doit jamais bloquer l'e-mail de confirmation
        }

        return $mail;
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