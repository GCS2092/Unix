<?php

namespace App\Console\Commands;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use App\Notifications\OrderReceptionReminderNotification;
use App\Services\CommunicationSettings;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class SendReceptionReminders extends Command
{
    protected $signature = 'orders:remind-reception {--days=5 : Jours apres expedition/mise a disposition}';

    protected $description = 'Relance par e-mail les clients qui n\'ont pas confirme la reception de leur commande.';

    public function handle(): int
    {
        if (! app(CommunicationSettings::class)->get('send_stage_emails')) {
            $this->info('E-mails d\'etape desactives : aucun rappel.');

            return self::SUCCESS;
        }

        $days = max(1, (int) $this->option('days'));
        $steps = ['shipped', 'ready', 'delivered'];
        $sent = 0;

        $orders = Order::query()
            ->where('status', OrderStatus::Paid->value)
            ->whereNull('received_confirmed_at')
            ->whereNull('reception_reminded_at')
            ->whereIn('fulfillment_status', $steps)
            ->whereHas('events', fn ($q) => $q->whereIn('step', $steps)->where('created_at', '<=', now()->subDays($days)))
            ->get();

        foreach ($orders as $order) {
            try {
                $email = $order->recipientEmail();
                if ($email === null) {
                    continue;
                }
                $recipient = $order->user ?? User::query()->where('email', $email)->first();
                if ($recipient) {
                    $recipient->notify(new OrderReceptionReminderNotification($order));
                } else {
                    Notification::route('mail', $email)->notify(new OrderReceptionReminderNotification($order));
                }
                Order::query()->whereKey($order->id)->update(['reception_reminded_at' => now()]);
                $sent++;
            } catch (\Throwable $e) {
                report($e);
            }
        }

        $this->info("$sent rappel(s) envoye(s).");

        return self::SUCCESS;
    }
}