<?php

use App\Http\Controllers\Admin\ActivityLogController;
use App\Http\Controllers\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Admin\DashboardBadgesController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\EnrollmentRemovalController;
use App\Http\Controllers\Admin\FormationsController;
use App\Http\Controllers\Admin\InviteeController;
use App\Http\Controllers\Admin\JoinRequestController;
use App\Http\Controllers\Admin\LiveController;
use App\Http\Controllers\Admin\MeetingController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\OverviewController;
use App\Http\Controllers\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\StockController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Api\AddressController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CertificateController;
use App\Http\Controllers\Api\CinetPayWebhookController;
use App\Http\Controllers\Api\CoursePlaybackController;
use App\Http\Controllers\Api\EnrollmentController;
use App\Http\Controllers\Api\GuestLiveController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LiveKitController;
use App\Http\Controllers\Api\LiveSessionController;
use App\Http\Controllers\Api\LiveStatusController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Storefront\CartController;
use App\Http\Controllers\Storefront\CatalogController;
use App\Http\Controllers\Storefront\CheckoutController;
use App\Http\Controllers\Storefront\CheckoutReturnController;
use App\Http\Controllers\Storefront\CheckoutStatusController;
use App\Http\Controllers\Storefront\CurrencyController;
use App\Http\Controllers\Storefront\FakePaymentController;
use Illuminate\Support\Facades\Route;

Route::get('currencies', [CurrencyController::class, 'index']);
Route::post('/cinetpay/notify', [CinetPayWebhookController::class, 'handle'])
    ->middleware('throttle:cinetpay-webhook')
    ->name('cinetpay.notify');

Route::match(['get', 'post'], '/checkout/return', CheckoutReturnController::class)
    ->name('cinetpay.return');

Route::prefix('v1')->name('api.v1.')->group(function (): void {
    Route::post('/auth/register', [AuthController::class, 'register'])
        ->middleware('throttle:auth-attempts');
    Route::post('/auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:auth-attempts');
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:auth-attempts');
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])
        ->middleware('throttle:auth-attempts');

    Route::get('/checkout/status', CheckoutStatusController::class)
        ->middleware('throttle:60,1');

    Route::post('/livekit/guest-token', [GuestLiveController::class, 'token'])
        ->middleware('throttle:10,1');

    Route::post('/livekit/guest-request', [GuestLiveController::class, 'createRequest'])
        ->middleware('throttle:10,1');
    Route::get('/livekit/guest-request/{id}', [GuestLiveController::class, 'requestStatus'])
        ->whereNumber('id')
        ->middleware('throttle:120,1');
    Route::get('/livekit/guest-status', [GuestLiveController::class, 'status'])
        ->middleware('throttle:120,1');

    Route::get('/catalog/courses', [CatalogController::class, 'courses']);
    Route::get('/catalog/courses/{course:slug}', [CatalogController::class, 'course']);
    Route::get('/track/{token}', [\App\Http\Controllers\Api\OrderTrackingController::class, 'showByToken'])->middleware('throttle:30,1');
Route::post('/track/{token}/confirm-received', [\App\Http\Controllers\Api\OrderTrackingController::class, 'confirmByToken'])->middleware('throttle:30,1');
    Route::get('/catalog/products', [CatalogController::class, 'products']);
    Route::get('/catalog/products/{product:slug}', [CatalogController::class, 'product']);

    Route::middleware(['web', 'sanctum.optional'])->group(function (): void {
        Route::get('/cart', [CartController::class, 'show']);
        Route::post('/cart/items', [CartController::class, 'add']);
        Route::patch('/cart/items/{type}/{id}', [CartController::class, 'update']);
        Route::delete('/cart/items/{type}/{id}', [CartController::class, 'remove']);
        Route::post('/checkout', [CheckoutController::class, 'store']);
    });

    Route::middleware(['auth:sanctum', 'not.blocked'])->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::patch('/profile', [ProfileController::class, 'update']);
        Route::put('/profile/password', [ProfileController::class, 'updatePassword']);
        Route::get('/addresses', [AddressController::class, 'index']);
        Route::post('/addresses', [AddressController::class, 'store']);
        Route::patch('/addresses/{address}', [AddressController::class, 'update']);
        Route::delete('/addresses/{address}', [AddressController::class, 'destroy']);

        Route::get('/live/sessions', [LiveSessionController::class, 'index'])->name('live.sessions');
        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('/notifications/read-all', [NotificationController::class, 'readAll'])->name('notifications.read_all');
        Route::post('/notifications/{id}/read', [NotificationController::class, 'read'])->name('notifications.read');
        Route::get('/orders', [OrderController::class, 'index']);
        Route::get('/orders/{order}', [OrderController::class, 'show']);
        Route::post('/orders/{order}/retry-payment', [OrderController::class, 'retryPayment']);
        Route::post('/orders/{order}/confirm-received', [\App\Http\Controllers\Api\OrderTrackingController::class, 'confirmReceived']);
        Route::get('/orders/{order}/invoice', [InvoiceController::class, 'download'])
            ->name('orders.invoice');

        Route::middleware('student')->group(function (): void {
            Route::get('/enrollments', [EnrollmentController::class, 'index']);
            Route::get('/enrollments/{enrollment}', [EnrollmentController::class, 'show']);
            Route::patch('/enrollments/{enrollment}/progress', [EnrollmentController::class, 'updateProgress']);
            Route::post('/enrollments/{enrollment}/complete', [EnrollmentController::class, 'complete']);
            Route::post('/enrollments/{enrollment}/certificate', [CertificateController::class, 'issue']);
            Route::get('/certificates/{certificate}/download', [CertificateController::class, 'download'])
                ->name('certificates.download');

            Route::post('/livekit/token', [LiveKitController::class, 'token']);
            Route::get('/live/status', LiveStatusController::class);
            Route::get('/courses/{course}/playback', [CoursePlaybackController::class, 'show']);
        });

        Route::middleware('admin')->prefix('admin')->group(function (): void {

            // ===== BOUTIQUE =====
            Route::middleware('admin.scope:shop')->group(function (): void {
                Route::get('/dashboard/badges', DashboardBadgesController::class)->name('admin.dashboard.badges');
                Route::get('/dashboard', DashboardController::class)->name('admin.dashboard');
                Route::get('/overview', OverviewController::class)->name('admin.overview');
                Route::get('/overview/pdf', [OverviewController::class, 'pdf'])->name('admin.overview.pdf');
                Route::get('/settings', [SettingsController::class, 'index'])->name('admin.settings');
                Route::put('/settings', [SettingsController::class, 'update'])->name('admin.settings.update');

                Route::get('stock', [StockController::class, 'index'])->name('admin.stock');
                Route::get('stock/movements', [StockController::class, 'movements'])->name('admin.stock.movements');
                Route::get('stock/export', [StockController::class, 'export'])->name('admin.stock.export');

                Route::apiResource('products', AdminProductController::class)->names('admin.products');
                Route::post('products/{product}/stock', [AdminProductController::class, 'adjustStock']);
                Route::get('products/{product}/stock-movements', [AdminProductController::class, 'stockMovements']);
                Route::post('products/{product}/image', [AdminProductController::class, 'uploadImage']);
                Route::post('/products/{product}/images', [AdminProductController::class, 'addGalleryImage']);
                Route::delete('/products/{product}/images/{image}', [AdminProductController::class, 'removeGalleryImage']);
                Route::delete('products/{product}/image', [AdminProductController::class, 'removeImage']);

                Route::get('/orders/export', [AdminOrderController::class, 'export'])->name('admin.orders.export');
                Route::get('/orders', [AdminOrderController::class, 'index']);
                Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
                Route::post('/orders/{order}/mark-paid', [AdminOrderController::class, 'markPaid']);
                Route::post('/orders/bulk-advance', [AdminOrderController::class, 'bulkAdvance']);
                Route::post('/orders/{order}/cancel', [AdminOrderController::class, 'cancel']);
                Route::post('/orders/{order}/resolve-stock-conflict', [AdminOrderController::class, 'resolveStockConflict']);
                Route::patch('/orders/{order}/fulfillment', [AdminOrderController::class, 'updateFulfillment']);
                Route::patch('/orders/{order}/tracking', [\App\Http\Controllers\Admin\OrderTrackingController::class, 'update']);

                Route::get('/invoices', [App\Http\Controllers\Admin\InvoiceController::class, 'index']);
                Route::post('/invoices/zip', [App\Http\Controllers\Admin\InvoiceController::class, 'zip']);
                Route::get('/invoices/{invoice}/pdf', [App\Http\Controllers\Admin\InvoiceController::class, 'pdf']);
            });

            // ===== FORMATION =====
            Route::middleware('admin.scope:formation')->group(function (): void {
                Route::get('/formations/dashboard', [FormationsController::class, 'dashboard'])->name('admin.formations.dashboard');
                Route::post('/formations/students', [FormationsController::class, 'storeStudent'])->name('admin.formations.students');
                Route::post('/formations/enroll', [FormationsController::class, 'enroll'])->name('admin.formations.enroll');

                Route::get('/enrollments', [App\Http\Controllers\Admin\EnrollmentController::class, 'index'])->name('admin.enrollments');
                Route::post('/enrollments/{enrollment}/certificate', [App\Http\Controllers\Admin\EnrollmentController::class, 'reissue'])->name('admin.enrollments.certificate');
                Route::delete('/enrollments/{id}', [EnrollmentRemovalController::class, 'destroy'])->whereNumber('id')->name('admin.enrollments.remove');

                Route::post('/courses/{course}/live/start', [LiveController::class, 'start'])->name('admin.live.start');
                Route::post('/courses/{course}/live/stop', [LiveController::class, 'stop'])->name('admin.live.stop');
                Route::post('/courses/{course}/live/permit', [LiveController::class, 'permit'])->name('admin.live.permit');
                Route::post('/courses/{course}/live/kick', [LiveController::class, 'kick'])->name('admin.live.kick');
                Route::get('/courses/{course}/meeting', [MeetingController::class, 'show'])->name('admin.meeting.show');
                Route::put('/courses/{course}/meeting', [MeetingController::class, 'update'])->name('admin.meeting.update');
                Route::post('/courses/{course}/meeting/invite', [MeetingController::class, 'regenerate'])->name('admin.meeting.invite');
                Route::get('/meeting/invitees', [InviteeController::class, 'index'])->name('admin.meeting.invitees');
                Route::post('/courses/{course}/meeting/send-invitations', [InviteeController::class, 'send'])->middleware('throttle:10,1')->name('admin.meeting.send');
                Route::get('/courses/{course}/join-requests', [JoinRequestController::class, 'index'])->name('admin.join.index');
                Route::post('/courses/{course}/join-requests/admit-all', [JoinRequestController::class, 'admitAll'])->name('admin.join.all');
                Route::post('/courses/{course}/join-requests/{id}/decide', [JoinRequestController::class, 'decide'])->name('admin.join.decide');

                Route::get('/live-sessions', [App\Http\Controllers\Admin\LiveSessionController::class, 'index'])->name('admin.sessions.index');
                Route::post('/live-sessions', [App\Http\Controllers\Admin\LiveSessionController::class, 'store'])->name('admin.sessions.store');
                Route::delete('/live-sessions/{id}', [App\Http\Controllers\Admin\LiveSessionController::class, 'destroy'])->name('admin.sessions.destroy');

                Route::apiResource('courses', AdminCourseController::class)->names('admin.courses');
            });

            // ===== COMMUN (super admin uniquement) =====
            Route::middleware('admin.scope:super')->group(function (): void {
                Route::get('/users', [UserController::class, 'index'])->name('admin.users');
                Route::patch('/users/{user}', [UserController::class, 'update'])->name('admin.users.update');
                Route::get('/activity-logs', [ActivityLogController::class, 'index'])->name('admin.activity');
            });
        });
    });
});

Route::get('/shipping', fn () => response()->json(['data' => [
    'pickup_fee' => (int) config('shipping.pickup_fee', 0),
    'zones' => collect(config('shipping.zones', []))
        ->map(fn ($z, $k) => ['key' => $k, 'fee' => (int) ($z['fee'] ?? 0)])
        ->values(),
]]));

if (config('payment.driver') === 'fake' && ! app()->isProduction()) {
    Route::get('/dev/pay/{transaction}', [FakePaymentController::class, 'show'])
        ->name('payment.fake.show');
    Route::post('/dev/pay/{transaction}', [FakePaymentController::class, 'complete'])
        ->name('payment.fake.complete');
}
