<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');


\Illuminate\Support\Facades\Schedule::command('orders:release-expired')->everyMinute()->withoutOverlapping();

\Illuminate\Support\Facades\Schedule::command('live:remind')->everyMinute();

\Illuminate\Support\Facades\Schedule::command('orders:remind-reception')->dailyAt('10:00');

\Illuminate\Support\Facades\Schedule::command('courses:remind-stalled')->dailyAt('09:00')->withoutOverlapping();

\Illuminate\Support\Facades\Schedule::command('courses:remind-exam')->dailyAt('09:30')->withoutOverlapping();

\Illuminate\Support\Facades\Schedule::command('payments:purge-proofs')->daily();

\Illuminate\Support\Facades\Schedule::call(fn () => \Illuminate\Support\Facades\Cache::put('scheduler_heartbeat', now()->timestamp, 3600))->name('scheduler-heartbeat')->everyMinute();

\Illuminate\Support\Facades\Schedule::command('queue:prune-failed --hours=720')->daily();
