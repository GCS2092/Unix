<?php

use App\Http\Controllers\Admin\ResourceImportController;
use App\Support\Import\ImportRegistry;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/admin/import')
    ->middleware(['auth:sanctum', 'not.blocked', 'admin'])
    ->name('admin.import.')
    ->group(function (): void {
        foreach (['shop', 'formation'] as $scope) {
            Route::prefix($scope)->middleware("admin.scope:$scope")->group(function () use ($scope): void {
                $keys = ImportRegistry::keysForScope($scope);
                Route::post('{resource}/analyze', [ResourceImportController::class, 'analyze'])
                    ->whereIn('resource', $keys)->middleware('throttle:30,1')->name("analyze.$scope");
                Route::get('{resource}/template', [ResourceImportController::class, 'template'])
                    ->whereIn('resource', $keys)->name("template.$scope");
                Route::post('{resource}', [ResourceImportController::class, 'import'])
                    ->whereIn('resource', $keys)->middleware('throttle:10,1')->name("run.$scope");
            });
        }
    });