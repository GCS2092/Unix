<?php

namespace App\Console\Commands;

use App\Services\CommunicationSettings;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CheckNotifications extends Command
{
    protected $signature = 'notifications:check';

    protected $description = "Controle la configuration des e-mails, de la file d'attente et du planificateur.";

    private int $problems = 0;

    public function handle(): int
    {
        $prod = app()->isProduction();
        $this->info('Controle des notifications (environnement : '.app()->environment().')');

        $queue = (string) config('queue.default');
        if ($queue === 'sync') {
            $this->checkFail("QUEUE_CONNECTION=sync : les e-mails partent pendant la requete HTTP (lent, un echec SMTP ralentit l'admin).", $prod);
        } else {
            $this->checkOk("File d'attente : $queue");
        }

        if ($queue === 'database') {
            if (! Schema::hasTable('jobs')) {
                $this->checkFail('Table jobs absente : php artisan migrate', true);
            } else {
                $pending = DB::table('jobs')->count();
                $oldest = DB::table('jobs')->min('created_at');
                if ($pending > 0 && $oldest !== null && now()->timestamp - (int) $oldest > 300) {
                    $this->checkFail("$pending job(s) en attente, le plus ancien depuis plus de 5 min : le worker (queue:work) ne tourne probablement pas.", true);
                } else {
                    $this->checkOk("Jobs en attente : $pending");
                }
            }
        }

        if (Schema::hasTable('failed_jobs')) {
            $failed = DB::table('failed_jobs')->count();
            if ($failed > 0) {
                $this->checkNote("$failed job(s) en echec : php artisan queue:failed, puis php artisan queue:retry all");
            } else {
                $this->checkOk('Aucun job en echec');
            }
        }

        $mailer = (string) config('mail.default');
        if (in_array($mailer, ['log', 'array'], true)) {
            $this->checkFail("MAIL_MAILER=$mailer : aucun e-mail reel ne part.", $prod);
        } else {
            $this->checkOk("Mailer : $mailer");
        }

        if ($mailer === 'smtp') {
            $host = (string) config('mail.mailers.smtp.host');
            if (in_array($host, ['127.0.0.1', 'localhost', 'mailpit', 'mailhog'], true)) {
                $this->checkFail("SMTP local ($host) : aucun e-mail reel ne partira.", $prod);
            } else {
                $this->checkOk("SMTP : $host");
            }
        }

        $from = (string) config('mail.from.address');
        if ($from === '' || preg_match('/(\.test|\.local|example\.(com|org))$/i', $from)) {
            $this->checkFail("Adresse d'expediteur factice ou vide ($from) : risque de rejet par les boites mail.", $prod);
        } else {
            $this->checkOk("Expediteur : $from");
        }

        $front = (string) config('app.frontend_url');
        if ($front === '' || str_contains($front, 'localhost') || str_contains($front, '127.0.0.1')) {
            $this->checkFail("FRONTEND_URL = \"$front\" : les liens de suivi des e-mails seraient inutilisables.", $prod);
        } else {
            $this->checkOk("Liens des e-mails : $front");
        }

        if (app(CommunicationSettings::class)->get('send_stage_emails')) {
            $this->checkOk("E-mails d'etape actives (Reglages > Communications)");
        } else {
            $this->checkFail("E-mails d'etape DESACTIVES dans Reglages > Communications : les clients ne recoivent ni preparation, ni expedition.", true);
        }

        $beat = Cache::get('scheduler_heartbeat');
        if ($beat === null || now()->timestamp - (int) $beat > 180) {
            $this->checkFail('Planificateur muet (rappels, expiration des reservations) : le cron "* * * * * php artisan schedule:run" ne tourne pas.', $prod);
        } else {
            $this->checkOk('Planificateur actif');
        }

        $this->newLine();
        if ($this->problems > 0) {
            $this->error("{$this->problems} probleme(s) bloquant(s).");

            return self::FAILURE;
        }
        $this->info('Aucun probleme bloquant.');

        return self::SUCCESS;
    }

    private function checkOk(string $m): void
    {
        $this->line("  <fg=green>[OK]</> $m");
    }

    private function checkNote(string $m): void
    {
        $this->line("  <fg=yellow>[!]</> $m");
    }

    private function checkFail(string $m, bool $blocking): void
    {
        if ($blocking) {
            $this->problems++;
            $this->line("  <fg=red>[ERREUR]</> $m");
        } else {
            $this->checkNote($m.' (acceptable hors production)');
        }
    }
}