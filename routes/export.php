<?php

use App\Http\Controllers\Admin\ExportController;
use App\Support\Export\ExportRegistry;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/export')
    ->middleware(['auth:sanctum', 'not.blocked', 'admin'])
    ->name('admin.export.')
    ->group(function (): void {
        foreach (['shop', 'formation'] as $scope) {
            Route::prefix($scope)->middleware("admin.scope:$scope")->group(function () use ($scope): void {
                Route::get('{resource}', [ExportController::class, 'download'])
                    ->whereIn('resource', ExportRegistry::keysForScope($scope))
                    ->middleware('throttle:10,1')
                    ->name("download.$scope");
            });
        }
    });