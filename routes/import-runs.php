<?php

use App\Http\Controllers\Admin\ImportRunController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/import-runs')
    ->middleware(['auth:sanctum', 'not.blocked', 'admin'])
    ->group(function (): void {
        Route::get('{run}', [ImportRunController::class, 'show'])->whereNumber('run')->middleware('throttle:120,1')->name('admin.import-runs.show');
    });