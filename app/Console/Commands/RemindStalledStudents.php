<?php

namespace App\Console\Commands;

use App\Models\Enrollment;
use App\Models\ReminderLog;
use App\Notifications\LiveInvitationNotification;
use App\Notifications\StalledReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RemindStalledStudents extends Command
{
    protected $signature = 'courses:remind-stalled {--dry : Affiche sans envoyer}';

    protected $description = 'Relance les eleves sans activite depuis 7 jours (3 rappels maximum par inscription)';

    public function handle(): int
    {
        if (! LiveInvitationNotification::mailReady()) {
            $this->warn("L'envoi d'e-mails n'est pas configure : rien envoye.");

            return self::SUCCESS;
        }

        $cut = now()->subDays(7);
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $dry = (bool) $this->option('dry');
        $sent = 0;

        Enrollment::query()
            ->with(['user', 'course'])
            ->whereNull('completed_at')
            ->where('progress', '<', 100)
            ->whereHas('course', fn ($c) => $c->where('is_published', true))
            ->where(fn ($q) => $q->where('last_heartbeat_at', '<', $cut)
                ->orWhere(fn ($w) => $w->whereNull('last_heartbeat_at')->where('created_at', '<', $cut)))
            ->chunkById(200, function ($rows) use ($base, $dry, &$sent): void {
                foreach ($rows as $e) {
                    if ($e->user === null || $e->course === null || $e->user->is_blocked) {
                        continue;
                    }
                    if (! ReminderLog::isDue($e->id, 'stalled', 7, 3)) {
                        continue;
                    }
                    if ($dry) {
                        $this->line("[dry] {$e->user->email} : {$e->course->title}");
                        $sent++;

                        continue;
                    }
                    try {
                        $e->user->notify(new StalledReminderNotification(
                            (string) $e->course->title,
                            (int) $e->progress,
                            $base.'/etudiant/cours/'.$e->id,
                        ));
                        ReminderLog::record($e->id, 'stalled');
                        $sent++;
                    } catch (\Throwable $ex) {
                        Log::warning('Rappel inactivite echoue (inscription '.$e->id.') : '.$ex->getMessage());
                    }
                }
            });

        $this->info($sent.' rappel(s) '.($dry ? 'a envoyer.' : 'envoye(s).'));

        return self::SUCCESS;
    }
}