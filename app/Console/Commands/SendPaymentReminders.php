<?php

namespace App\Console\Commands;

use App\Models\Enrollment;
use App\Notifications\LiveInvitationNotification;
use App\Notifications\PaymentReminderNotification;
use App\Services\EnrollmentBalance;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SendPaymentReminders extends Command
{
    protected $signature = 'payments:remind {--dry-run : Affiche les relances sans rien envoyer}';

    protected $description = 'Relance les etudiants dont le solde de formation approche ou depasse l\'echeance';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');

        if (! $dry && ! LiveInvitationNotification::mailReady()) {
            $this->error('L\'envoi d\'e-mails n\'est pas configure : aucune relance envoyee.');

            return self::FAILURE;
        }

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $today = now()->startOfDay();
        $sent = 0;
        $listed = 0;

        Enrollment::query()
            ->where('payment_tracked', true)
            ->whereHas('course', fn ($c) => $c->whereNotNull('balance_due_days'))
            ->with(['course', 'user'])
            ->chunkById(200, function ($rows) use (&$sent, &$listed, $dry, $base, $today): void {
                foreach ($rows as $e) {
                    $user = $e->user;
                    if ($user === null || $user->is_blocked) {
                        continue;
                    }

                    $summary = EnrollmentBalance::summary($e);
                    if ($summary['balance'] <= 0) {
                        continue;
                    }

                    $due = EnrollmentBalance::dueAt($e);
                    if ($due === null) {
                        continue;
                    }

                    $delta = (int) $today->diffInDays($due->copy()->startOfDay(), false);
                    $kind = self::kindFor($delta);
                    if ($kind === null) {
                        continue;
                    }

                    $already = DB::table('enrollment_payment_reminders')->where('enrollment_id', $e->id)->where('kind', $kind)->exists();
                    if ($already) {
                        continue;
                    }

                    $listed++;
                    $line = $kind.' · '.$user->email.' · '.($e->course?->title ?? '?').' · reste '.$summary['balance'];

                    if ($dry) {
                        $this->line($line);

                        continue;
                    }

                    $fresh = DB::table('enrollment_payment_reminders')->insertOrIgnore([
                        'enrollment_id' => $e->id, 'kind' => $kind, 'sent_at' => now(), 'created_at' => now(), 'updated_at' => now(),
                    ]);
                    if ($fresh === 0) {
                        continue;
                    }

                    try {
                        $user->notify(new PaymentReminderNotification(
                            (string) ($e->course?->title ?? ''),
                            (int) $summary['balance'],
                            $due->format('d/m/Y'),
                            $delta,
                            ! EnrollmentBalance::hasAccess($e),
                            $base.'/etudiant',
                        ));
                        $sent++;
                        $this->line($line);
                    } catch (\Throwable $ex) {
                        report($ex);
                        DB::table('enrollment_payment_reminders')->where('enrollment_id', $e->id)->where('kind', $kind)->delete();
                    }
                }
            });

        $this->info($dry ? $listed.' relance(s) a envoyer (simulation).' : $sent.' relance(s) envoyee(s).');

        return self::SUCCESS;
    }

    /** Une seule relance par palier : 3 jours avant, le jour meme, puis a 1, 8 et 15 jours de retard. */
    private static function kindFor(int $delta): ?string
    {
        return match (true) {
            $delta > 3 => null,
            $delta > 0 => 'before',
            $delta === 0 => 'due',
            $delta >= -7 => 'late1',
            $delta >= -14 => 'late2',
            default => 'late3',
        };
    }
}