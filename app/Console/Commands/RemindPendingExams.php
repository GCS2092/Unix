<?php

namespace App\Console\Commands;

use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\ReminderLog;
use App\Notifications\ExamReminderNotification;
use App\Notifications\LiveInvitationNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class RemindPendingExams extends Command
{
    protected $signature = 'courses:remind-exam {--dry : Affiche sans envoyer}';

    protected $description = 'Rappelle l\'examen aux eleves qui ont fini la video (2 rappels maximum)';

    public function handle(): int
    {
        if (! LiveInvitationNotification::mailReady()) {
            $this->warn("L'envoi d'e-mails n'est pas configure : rien envoye.");

            return self::SUCCESS;
        }

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');
        $dry = (bool) $this->option('dry');
        $cut = now()->subDays(2);
        $sent = 0;

        Enrollment::query()
            ->with(['user', 'course'])
            ->whereNotNull('completed_at')
            ->where('completed_at', '<', $cut)
            ->whereDoesntHave('certificate')
            ->chunkById(200, function ($rows) use ($base, $dry, &$sent): void {
                foreach ($rows as $e) {
                    if ($e->user === null || $e->course === null || $e->user->is_blocked) {
                        continue;
                    }

                    $quiz = Quiz::query()->where('course_id', $e->course_id)->where('is_published', true)->first();
                    if ($quiz === null || $e->examPassed()) {
                        continue;
                    }

                    $used = QuizAttempt::query()->where('enrollment_id', $e->id)->where('quiz_id', $quiz->id)->count();
                    if ($used >= (int) $quiz->max_attempts + (int) $e->bonus_attempts) {
                        continue; // plus de tentatives : inutile de relancer
                    }
                    if (! ReminderLog::isDue($e->id, 'exam', 4, 2)) {
                        continue;
                    }

                    if ($dry) {
                        $this->line("[dry] {$e->user->email} : {$e->course->title}");
                        $sent++;

                        continue;
                    }
                    try {
                        $e->user->notify(new ExamReminderNotification(
                            (string) $e->course->title,
                            $base.'/etudiant/cours/'.$e->id.'/examen',
                        ));
                        ReminderLog::record($e->id, 'exam');
                        $sent++;
                    } catch (\Throwable $ex) {
                        Log::warning('Rappel examen echoue (inscription '.$e->id.') : '.$ex->getMessage());
                    }
                }
            });

        $this->info($sent.' rappel(s) '.($dry ? 'a envoyer.' : 'envoye(s).'));

        return self::SUCCESS;
    }
}