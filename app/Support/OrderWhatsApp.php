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

    /** Lien wa.me vers le CLIENT, avec sa reference et son lien de suivi (null sans telephone). */
    public static function customerUrl(Order $o): ?string
    {
        $d = preg_replace('/\D+/', '', (string) $o->phone) ?: '';
        if (strlen($d) < 8) {
            return null;
        }
        if (strlen($d) === 9) {
            $d = '221'.$d;
        }

        $fr = $o->locale !== 'en';
        $track = rtrim((string) config('app.frontend_url', config('app.url')), '/').'/suivi/'.$o->ensureTrackingToken();
        $name = trim((string) ($o->user?->name ?? $o->guest_name ?? ''));
        $ref = self::code($o);
        $text = $fr
            ? "Bonjour{$name}, nous avons bien reçu votre paiement pour la commande {$ref}. Suivez-la et téléchargez votre facture ici : {$track}"
            : "Hello{$name}, we have received your payment for order {$ref}. Track it and download your invoice here: {$track}";
        if ($name !== '') {
            $text = str_replace(['Bonjour'.$name, 'Hello'.$name], [$fr ? 'Bonjour '.$name : '', $fr ? '' : 'Hello '.$name], $text);
        }

        return 'https://wa.me/'.$d.'?text='.rawurlencode($text);
    }}