<?php

use App\Http\Controllers\Admin\SiteInfoController;
use App\Http\Controllers\Api\PublicSiteInfoController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/public/site-info', [PublicSiteInfoController::class, 'show'])->middleware('throttle:60,1');

    Route::middleware(['auth:sanctum', 'not.blocked', 'admin', 'admin.scope:shop'])
        ->prefix('admin')
        ->group(function (): void {
            Route::get('/site-info', [SiteInfoController::class, 'show'])->name('admin.site-info');
            Route::put('/site-info', [SiteInfoController::class, 'update'])->name('admin.site-info.update');
        });
});