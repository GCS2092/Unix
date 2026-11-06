<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use App\Notifications\AdminOrderAlertNotification;
use Illuminate\Support\Facades\Notification;

class AdminAlerts
{
    public function __construct(private readonly CommunicationSettings $settings)
    {
    }

    public function orderPaid(Order $order): void
    {
        $this->send($order, 'paid');
    }

    public function stockConflict(Order $order): void
    {
        $this->send($order, 'stock_conflict');
    }

    /**
     * Destinataires d'un type d'alerte : liste du type, sinon admin_alert_email, sinon tous les admins.
     *
     * @return list<string>
     */
    public function recipients(string $kind = 'paid'): array
    {
        $specific = $this->parse((string) $this->settings->get($kind === 'stock_conflict' ? 'admin_alert_stock_to' : 'admin_alert_paid_to'));
        if ($specific !== []) {
            return $specific;
        }

        $general = $this->parse((string) $this->settings->get('admin_alert_email'));
        if ($general !== []) {
            return $general;
        }

        return User::query()->where('is_admin', true)->whereNotNull('email')->pluck('email')->values()->all();
    }

    /** @return list<string> */
    private function parse(string $raw): array
    {
        return array_values(array_unique(array_filter(array_map('trim', preg_split('/[,;\s]+/', $raw) ?: []))));
    }

    private function send(Order $order, string $kind): void
    {
        try {
            if (! $this->settings->get('send_admin_alerts')) {
                return;
            }
            if (! $this->settings->get($kind === 'stock_conflict' ? 'send_admin_alert_stock' : 'send_admin_alert_paid')) {
                return;
            }
            $emails = $this->recipients($kind);
            if ($emails === []) {
                return;
            }
            Notification::route('mail', $emails)->notify(new AdminOrderAlertNotification($order, $kind));
        } catch (\Throwable $e) {
            report($e); // l'alerte est secondaire : jamais bloquante
        }
    }
}