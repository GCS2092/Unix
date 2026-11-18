<?php

namespace App\Support;

use App\Models\Order;
use App\Services\CommunicationSettings;

/** Message WhatsApp pre-rempli de confirmation de commande (lien wa.me, envoi par un clic). */
class OrderWhatsApp
{
    public static function code(Order $o): string
    {
        return (string) ($o->public_ref ?: '#'.$o->id);
    }

    public static function adminUrl(): string
    {
        return rtrim((string) config('app.frontend_url', config('app.url')), '/').'/admin/boutique/commandes';
    }

    public static function message(Order $o): string
    {
        $name = trim((string) ($o->user?->name ?? $o->guest_name ?? '')) ?: 'Client';
        $when = ($o->paid_at ?? $o->created_at)?->timezone(config('app.timezone'))->format('d/m/Y à H:i');
        $cur = $o->currency === 'XOF' ? 'FCFA' : (string) $o->currency;
        $total = number_format((int) $o->total, 0, ',', ' ').' '.$cur;
        $status = $o->isPaid() ? '✅ Paiement confirmé' : '⏳ Paiement à confirmer';
        $method = $o->payment_method ? ' ('.$o->payment_method.')' : '';

        return "🛒 *Nouvelle commande*\n"
            ."Commande : *".self::code($o)."*\n"
            ."Client : *{$name}*\n"
            ."Date : {$when}\n"
            ."Montant : {$total}\n"
            ."Statut : {$status}{$method}\n"
            ."Voir : ".self::adminUrl();
    }

    public static function url(Order $o, ?string $number = null): string
    {
        $number ??= (string) app(CommunicationSettings::class)->get('admin_alert_whatsapp');
        $digits = preg_replace('/\D+/', '', $number) ?: '';

        return 'https://wa.me/'.$digits.'?text='.rawurlencode(self::message($o));
    }
}