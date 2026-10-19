<?php

use App\Http\Controllers\Admin\ProductImportController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/product-import')
    ->middleware(['auth:sanctum', 'not.blocked', 'admin', 'admin.scope:shop'])
    ->name('admin.product-import.')
    ->group(function (): void {
        Route::post('/analyze', [ProductImportController::class, 'analyze'])->middleware('throttle:30,1')->name('analyze');
        Route::post('/', [ProductImportController::class, 'import'])->middleware('throttle:10,1')->name('run');
        Route::get('/template', [ProductImportController::class, 'template'])->name('template');
    });