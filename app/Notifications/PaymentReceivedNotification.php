<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Confirmation envoyee a l'etudiant apres l'enregistrement d'un versement. Envoi immediat. */
class PaymentReceivedNotification extends Notification
{
    private const PURPOSES = [
        'deposit' => 'Acompte', 'balance' => 'Solde', 'full' => 'Paiement total',
        'registration' => "Frais d'inscription", 'previous' => 'Reprise antérieure', 'other' => 'Autre',
    ];

    private const METHODS = [
        'cash' => 'Espèces', 'transfer' => 'Virement', 'mobile_money' => 'Mobile money', 'card' => 'Carte', 'other' => 'Autre',
    ];

    public function __construct(
        private readonly string $courseTitle,
        private readonly int $amount,
        private readonly string $purpose,
        private readonly string $method,
        private readonly string $paidOn,
        private readonly int $total,
        private readonly int $paid,
        private readonly int $balance,
        private readonly ?string $reference,
        private readonly string $url,
    ) {
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    private function money(int $n): string
    {
        return number_format($n, 0, ',', ' ').' FCFA';
    }

    public function toMail(object $notifiable): MailMessage
    {
        \App\Support\Brand::useSpace('formation');

        $mail = (new MailMessage)
            ->subject('Paiement reçu : '.$this->courseTitle)
            ->greeting('Bonjour '.($notifiable->name ?? '').',')
            ->line('Nous avons bien reçu votre paiement de **'.$this->money($this->amount).'** pour la formation « '.$this->courseTitle.' ».')
            ->line('Motif : '.(self::PURPOSES[$this->purpose] ?? $this->purpose).' · Moyen : '.(self::METHODS[$this->method] ?? $this->method).' · Date : '.$this->paidOn);

        if ($this->reference !== null && $this->reference !== '') {
            $mail->line('Référence : '.$this->reference);
        }

        if ($this->balance > 0) {
            $mail->line('Prix de la formation : '.$this->money($this->total))
                ->line('Déjà payé : '.$this->money($this->paid))
                ->line('Reste à payer : **'.$this->money($this->balance).'**');
        } else {
            $mail->line('Votre formation est entièrement réglée. Merci pour votre confiance !');
        }

        return $mail->action('Accéder à mon espace', $this->url);
    }
}