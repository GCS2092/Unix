<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');


\Illuminate\Support\Facades\Schedule::command('orders:release-expired')->everyMinute()->withoutOverlapping();

\Illuminate\Support\Facades\Schedule::command('live:remind')->everyMinute();

\Illuminate\Support\Facades\Schedule::command('orders:remind-reception')->dailyAt('10:00');
