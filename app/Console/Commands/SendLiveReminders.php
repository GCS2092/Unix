<?php

namespace App\Console\Commands;

use App\Models\LiveSession;
use App\Notifications\LiveSessionNotification;
use App\Services\LiveAudience;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SendLiveReminders extends Command
{
    protected $signature = 'live:remind';

    protected $description = 'Envoie un rappel environ 15 minutes avant les seances planifiees';

    public function handle(): int
    {
        $sessions = LiveSession::query()
            ->with('course')
            ->whereNull('reminded_at')
            ->where('starts_at', '<=', now()->addMinutes(15))
            ->where('starts_at', '>=', now()->subMinutes(5))
            ->get();

        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        foreach ($sessions as $session) {
            $course = $session->course;

            if ($course === null) {
                continue;
            }

            if ($course->invite_token === null) {
                $course->forceFill(['invite_token' => Str::random(40)])->save();
            }

            foreach (LiveAudience::recipients($course) as $r) {
                try {
                    $r['user']->notify(new LiveSessionNotification(
                        $course->id,
                        (string) $course->title,
                        $r['path'],
                        $base.$r['path'],
                        $session->starts_at->toIso8601String(),
                        $session->title,
                        $session->note,
                        true,
                    ));
                } catch (\Throwable $e) {
                    Log::warning('Rappel de seance echoue (user '.$r['user']->id.') : '.$e->getMessage());
                }
            }

            $session->forceFill(['reminded_at' => now()])->save();
        }

        $this->info($sessions->count().' rappel(s) traite(s).');

        return self::SUCCESS;
    }
}