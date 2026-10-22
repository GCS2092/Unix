<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class MailTest extends Command
{
    protected $signature = 'mail:test {to : Adresse qui recevra le message d essai}';

    protected $description = "Envoie un e-mail d'essai et affiche la configuration (sans les secrets)";

    public function handle(): int
    {
        $mailer = (string) config('mail.default');
        $this->info('Mailer : '.$mailer);

        if ($mailer === 'smtp') {
            $c = (array) config('mail.mailers.smtp');
            $this->line('Hote : '.($c['host'] ?? '?').' | Port : '.($c['port'] ?? '?'));
            $this->line('Utilisateur : '.(filled($c['username'] ?? null) ? $c['username'] : '(vide)'));
            $this->line('Mot de passe : '.(filled($c['password'] ?? null) ? '(renseigne)' : '(vide)'));
        }
        $this->line('Expediteur : '.config('mail.from.address').' ('.config('mail.from.name').')');

        if ($mailer === 'log') {
            $this->warn("Le mailer est 'log' : rien n'est envoye, le message ira dans storage/logs/laravel.log.");
        }

        try {
            Mail::raw("Message d'essai envoye par l'application.", function ($m): void {
                $m->to($this->argument('to'))->subject("Essai d'envoi");
            });
        } catch (\Throwable $e) {
            $this->error('Echec : '.$e->getMessage());

            return self::FAILURE;
        }

        $this->info('Envoye. Verifiez la boite de reception et les indesirables.');

        return self::SUCCESS;
    }
}