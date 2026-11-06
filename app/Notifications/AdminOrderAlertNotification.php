<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Alerte envoyee a l'equipe : nouvelle commande payee ou conflit de stock. */
class AdminOrderAlertNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @return list<int> */
    public function backoff(): array
    {
        return [60, 300];
    }

    public function __construct(public readonly Order $order, public readonly string $kind)
    {
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $order = $this->order;
        $ref = $order->public_ref ?: '#'.$order->id;
        $currency = $order->currency === 'XOF' ? 'FCFA' : (string) $order->currency;
        $total = number_format((int) $order->total, 0, ',', ' ').' '.$currency;
        $url = rtrim((string) config('app.frontend_url'), '/').'/admin/boutique/commandes';
        $customer = $order->user?->name ?? $order->guest_name ?? 'Client';
        $mode = match ($order->delivery_method) {
            'delivery' => 'Livraison',
            'pickup' => 'Retrait sur place',
            default => 'Sans livraison',
        };

        if ($this->kind === 'stock_conflict') {
            return (new MailMessage)
                ->subject("Conflit de stock : commande $ref")
                ->greeting('Action requise')
                ->line("La commande **$ref** a ete payee mais le stock est insuffisant.")
                ->line("Client : **$customer** - Total : **$total**")
                ->line('Reapprovisionnez le produit puis marquez le conflit comme traite, ou remboursez le client.')
                ->action('Ouvrir les commandes', $url);
        }

        return (new MailMessage)
            ->subject("Nouvelle commande payee $ref - $total")
            ->greeting('Nouvelle commande')
            ->line("Commande **$ref** payee par **$customer**.")
            ->line("Total : **$total** - Mode : **$mode**")
            ->line($order->recipientEmail() === null ? 'Aucun e-mail client : prevenez-le par WhatsApp ou telephone.' : 'Le client a recu sa confirmation par e-mail.')
            ->action('Ouvrir les commandes', $url);
    }
}