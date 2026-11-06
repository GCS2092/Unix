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

    /** Adresse(s) du reglage admin_alert_email, sinon tous les comptes administrateurs. @return list<string> */
    public function recipients(): array
    {
        $custom = trim((string) $this->settings->get('admin_alert_email'));
        if ($custom !== '') {
            return array_values(array_filter(array_map('trim', preg_split('/[,;\s]+/', $custom) ?: [])));
        }

        return User::query()->where('is_admin', true)->whereNotNull('email')->pluck('email')->values()->all();
    }

    private function send(Order $order, string $kind): void
    {
        try {
            if (! $this->settings->get('send_admin_alerts')) {
                return;
            }
            $emails = $this->recipients();
            if ($emails === []) {
                return;
            }
            Notification::route('mail', $emails)->notify(new AdminOrderAlertNotification($order, $kind));
        } catch (\Throwable $e) {
            report($e); // l'alerte est secondaire : jamais bloquante
        }
    }
}