<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Relance du solde : avant l'echeance, le jour meme, ou en retard. Envoi immediat. */
class PaymentReminderNotification extends Notification
{
    /** $daysFromDue : positif = jours restants, 0 = aujourd'hui, negatif = jours de retard. */
    public function __construct(
        private readonly string $courseTitle,
        private readonly int $balance,
        private readonly string $dueDate,
        private readonly int $daysFromDue,
        private readonly bool $suspended,
        private readonly string $url,
    ) {
    }

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        \App\Support\Brand::useSpace('formation');
        $amount = number_format($this->balance, 0, ',', ' ').' FCFA';
        $late = $this->daysFromDue < 0;

        $mail = (new MailMessage)
            ->subject(($late ? 'Paiement en retard : ' : 'Rappel de paiement : ').$this->courseTitle)
            ->greeting('Bonjour '.($notifiable->name ?? '').',');

        if ($late) {
            $d = abs($this->daysFromDue);
            $mail->line('L\'échéance du '.$this->dueDate.' pour la formation « '.$this->courseTitle.' » est dépassée de '.$d.' jour'.($d > 1 ? 's' : '').'.');
        } elseif ($this->daysFromDue === 0) {
            $mail->line('Le solde de votre formation « '.$this->courseTitle.' » est à régler aujourd\'hui.');
        } else {
            $mail->line('Il vous reste '.$this->daysFromDue.' jour'.($this->daysFromDue > 1 ? 's' : '').' (échéance le '.$this->dueDate.') pour régler le solde de votre formation « '.$this->courseTitle.' ».');
        }

        $mail->line('Reste à payer : **'.$amount.'**');

        if ($this->suspended) {
            $mail->line('Votre accès au cours est suspendu en attendant le règlement.');
        }

        return $mail
            ->line('Si vous avez déjà payé, répondez à ce message avec votre référence de paiement.')
            ->action('Accéder à mon espace', $this->url);
    }
}