<?php

use App\Http\Controllers\Storefront\ProductShareController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/p/{product}', [ProductShareController::class, 'show'])->name('product.share');
