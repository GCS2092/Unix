<?php

use App\Http\Controllers\Admin\AiMapController;
use Illuminate\Support\Facades\Route;

Route::post('v1/admin/ai-map', [AiMapController::class, 'suggest'])
    ->middleware(['auth:sanctum', 'not.blocked', 'admin', 'throttle:10,1'])
    ->name('admin.ai-map');