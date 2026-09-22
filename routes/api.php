<?php

use App\Http\Controllers\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CertificateController;
use App\Http\Controllers\Api\CinetPayWebhookController;
use App\Http\Controllers\Api\CoursePlaybackController;
use App\Http\Controllers\Api\EnrollmentController;
use App\Http\Controllers\Api\LiveKitController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Storefront\CartController;
use App\Http\Controllers\Storefront\CatalogController;
use App\Http\Controllers\Storefront\CheckoutController;
use Illuminate\Support\Facades\Route;

Route::post('/cinetpay/notify', [CinetPayWebhookController::class, 'handle'])
    ->name('cinetpay.notify');

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::get('/catalog/courses', [CatalogController::class, 'courses']);
    Route::get('/catalog/courses/{course:slug}', [CatalogController::class, 'course']);
    Route::get('/catalog/products', [CatalogController::class, 'products']);
    Route::get('/catalog/products/{product:slug}', [CatalogController::class, 'product']);

    Route::middleware(['web', 'sanctum.optional'])->group(function (): void {
        Route::get('/cart', [CartController::class, 'show']);
        Route::post('/cart/items', [CartController::class, 'add']);
        Route::patch('/cart/items/{type}/{id}', [CartController::class, 'update']);
        Route::delete('/cart/items/{type}/{id}', [CartController::class, 'remove']);
        Route::post('/checkout', [CheckoutController::class, 'store']);
    });

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{order}', [OrderController::class, 'show']);

        Route::get('/enrollments', [EnrollmentController::class, 'index']);
        Route::get('/enrollments/{enrollment}', [EnrollmentController::class, 'show']);
        Route::patch('/enrollments/{enrollment}/progress', [EnrollmentController::class, 'updateProgress']);
        Route::post('/enrollments/{enrollment}/complete', [EnrollmentController::class, 'complete']);
        Route::post('/enrollments/{enrollment}/certificate', [CertificateController::class, 'issue']);
        Route::get('/certificates/{certificate}/download', [CertificateController::class, 'download'])
            ->name('certificates.download');

        Route::post('/livekit/token', [LiveKitController::class, 'token']);
        Route::get('/courses/{course}/playback', [CoursePlaybackController::class, 'show']);

        Route::middleware('admin')->prefix('admin')->group(function (): void {
            Route::apiResource('courses', AdminCourseController::class);
            Route::apiResource('products', AdminProductController::class);

            Route::get('/orders', [AdminOrderController::class, 'index']);
            Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
            Route::post('/orders/{order}/mark-paid', [AdminOrderController::class, 'markPaid']);
        });
    });
});
