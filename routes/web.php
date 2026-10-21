<?php

use App\Http\Controllers\Storefront\ProductShareController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/p/{product}', [ProductShareController::class, 'show'])->name('product.share');
Route::get('/c/{course}', [\App\Http\Controllers\Storefront\CourseShareController::class, 'show'])->name('course.share');
