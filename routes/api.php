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
    Route::get('/faqs', [\App\Http\Controllers\Api\FaqController::class, 'index'])->middleware('throttle:60,1');
    Route::get('/presentations/media/{name}', [\App\Http\Controllers\Api\PresentationController::class, 'media'])->middleware('throttle:240,1');
    Route::get('/presentations/{space}', [\App\Http\Controllers\Api\PresentationController::class, 'show'])->whereIn('space', ['shop', 'formation', 'home'])->middleware('throttle:60,1');
    Route::post('/auth/register', [AuthController::class, 'register'])
        ->middleware('throttle:auth-attempts');
    Route::post('/auth/formation-signup', \App\Http\Controllers\Api\FormationSignupController::class)->middleware('throttle:10,1');
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

    Route::get('/certificates/verify/{code}', [\App\Http\Controllers\Api\CertificateVerifyController::class, 'show'])->middleware('throttle:30,1');
    Route::get('/catalog/courses/media/{name}', [\App\Http\Controllers\Api\CourseCoverController::class, 'media'])->middleware('throttle:240,1');
    Route::get('/catalog/courses', [CatalogController::class, 'courses']);
    Route::get('/catalog/courses/{course:slug}', [CatalogController::class, 'course']);
    Route::get('/track/{token}', [\App\Http\Controllers\Api\OrderTrackingController::class, 'showByToken'])->middleware(['throttle:30,1', \App\Http\Middleware\PrivateResponse::class]);
Route::post('/track/{token}/confirm-received', [\App\Http\Controllers\Api\OrderTrackingController::class, 'confirmByToken'])->middleware(['throttle:30,1', \App\Http\Middleware\PrivateResponse::class]);
    Route::get('/track/{token}/invoice', [\App\Http\Controllers\Api\OrderTrackingController::class, 'invoiceByToken'])->middleware(['throttle:10,1', \App\Http\Middleware\PrivateResponse::class]);
    Route::post('/track/{token}/retry-payment', [\App\Http\Controllers\Api\OrderTrackingController::class, 'retryByToken'])->middleware(['throttle:10,1', \App\Http\Middleware\PrivateResponse::class]);
    Route::post('/track/{token}/declare-payment', [\App\Http\Controllers\Api\PaymentClaimController::class, 'declareByToken'])->middleware(['throttle:10,1', \App\Http\Middleware\PrivateResponse::class]);
    Route::post('/track/lookup', [\App\Http\Controllers\Api\OrderTrackingController::class, 'lookup'])->middleware(['throttle:10,1', \App\Http\Middleware\PrivateResponse::class]);
    Route::get('/catalog/categories', [\App\Http\Controllers\Storefront\CategoryController::class, 'index']);
    Route::get('/catalog/products', [CatalogController::class, 'products']);
    Route::get('/auth/email/verify/{id}/{hash}', [\App\Http\Controllers\Api\VerifyEmailController::class, 'verify'])->middleware(['signed', 'throttle:20,1'])->name('auth.verify-email');
    Route::get('/public/communications', [\App\Http\Controllers\Api\PublicCommunicationController::class, 'show'])->middleware('throttle:60,1');
    Route::get('/public/shop', [\App\Http\Controllers\Api\PublicShopController::class, 'show'])->middleware('throttle:60,1');
    Route::get('/public/about', [\App\Http\Controllers\Api\PublicAboutController::class, 'show'])->middleware('throttle:60,1');
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
        Route::post('/orders/{order}/declare-payment', [\App\Http\Controllers\Api\PaymentClaimController::class, 'declare'])->middleware('throttle:10,1');
        Route::post('/orders/{order}/confirm-received', [\App\Http\Controllers\Api\OrderTrackingController::class, 'confirmReceived']);
        Route::post('/auth/email/resend', [\App\Http\Controllers\Api\VerifyEmailController::class, 'resend'])->middleware('throttle:3,1');
        Route::get('/orders/{order}/invoice', [InvoiceController::class, 'download'])
            ->name('orders.invoice');

        Route::middleware('student')->group(function (): void {
            Route::get('/enrollments', [EnrollmentController::class, 'index']);
            Route::get('/enrollments/{enrollment}', [EnrollmentController::class, 'show']);
            Route::patch('/enrollments/{enrollment}/progress', [EnrollmentController::class, 'updateProgress']);
            Route::post('/enrollments/{enrollment}/complete', [EnrollmentController::class, 'complete']);
            Route::get('/enrollments/{enrollment}/quiz', [\App\Http\Controllers\Api\QuizController::class, 'show']);
            Route::post('/enrollments/{enrollment}/quiz/attempts', [\App\Http\Controllers\Api\QuizController::class, 'submit'])->middleware('throttle:20,1');
            Route::post('/enrollments/{enrollment}/certificate', [CertificateController::class, 'issue']);
            Route::get('/certificates/{certificate}/download', [CertificateController::class, 'download'])
                ->name('certificates.download');

            Route::get('/enrollment-requests', [\App\Http\Controllers\Api\EnrollmentRequestController::class, 'index']);
            Route::post('/enrollment-requests', [\App\Http\Controllers\Api\EnrollmentRequestController::class, 'store'])->middleware('throttle:10,1');

            Route::post('/livekit/token', [LiveKitController::class, 'token']);
            Route::get('/live/status', LiveStatusController::class);
            Route::get('/courses/{course}/playback', [CoursePlaybackController::class, 'show']);
        });

        Route::middleware('admin')->prefix('admin')->group(function (): void {

            // ===== BOUTIQUE =====
            Route::middleware('admin.scope:shop')->group(function (): void {
                Route::get('/shop-faqs', [\App\Http\Controllers\Admin\FaqController::class, 'index'])->defaults('space', 'shop');
                Route::post('/shop-faqs/reorder', [\App\Http\Controllers\Admin\FaqController::class, 'reorder'])->defaults('space', 'shop');
                Route::post('/shop-faqs', [\App\Http\Controllers\Admin\FaqController::class, 'store'])->defaults('space', 'shop');
                Route::patch('/shop-faqs/{id}', [\App\Http\Controllers\Admin\FaqController::class, 'update'])->whereNumber('id')->defaults('space', 'shop');
                Route::delete('/shop-faqs/{id}', [\App\Http\Controllers\Admin\FaqController::class, 'destroy'])->whereNumber('id')->defaults('space', 'shop');
                Route::get('/dashboard/badges', DashboardBadgesController::class)->name('admin.dashboard.badges');
                Route::get('/dashboard', DashboardController::class)->name('admin.dashboard');
                Route::get('/overview', OverviewController::class)->name('admin.overview');
                Route::get('/overview/pdf', [OverviewController::class, 'pdf'])->name('admin.overview.pdf');
                Route::get('/settings', [SettingsController::class, 'index'])->name('admin.settings');
                Route::get('/shipping-zones', [\App\Http\Controllers\Admin\ShippingZoneController::class, 'index'])->name('admin.shipping-zones');
                Route::post('/shipping-zones', [\App\Http\Controllers\Admin\ShippingZoneController::class, 'store'])->name('admin.shipping-zones.store');
                Route::patch('/shipping-zones/{zone}', [\App\Http\Controllers\Admin\ShippingZoneController::class, 'update'])->name('admin.shipping-zones.update');
                Route::delete('/shipping-zones/{zone}', [\App\Http\Controllers\Admin\ShippingZoneController::class, 'destroy'])->name('admin.shipping-zones.destroy');

                Route::get('/categories', [\App\Http\Controllers\Admin\CategoryController::class, 'index'])->name('admin.categories');
                Route::post('/categories', [\App\Http\Controllers\Admin\CategoryController::class, 'store'])->name('admin.categories.store');
                Route::patch('/categories/{category}', [\App\Http\Controllers\Admin\CategoryController::class, 'update'])->name('admin.categories.update');
                Route::delete('/categories/{category}', [\App\Http\Controllers\Admin\CategoryController::class, 'destroy'])->name('admin.categories.destroy');
                Route::put('/settings', [SettingsController::class, 'update'])->name('admin.settings.update');
                Route::get('/settings/communications', [\App\Http\Controllers\Admin\CommunicationSettingsController::class, 'show'])->name('admin.settings.communications');
                Route::put('/settings/communications', [\App\Http\Controllers\Admin\CommunicationSettingsController::class, 'update'])->name('admin.settings.communications.update');
                Route::get('/settings/shop', [\App\Http\Controllers\Admin\ShopSettingsController::class, 'show'])->name('admin.settings.shop');
                Route::put('/settings/shop', [\App\Http\Controllers\Admin\ShopSettingsController::class, 'update'])->name('admin.settings.shop.update');
                Route::get('/settings/about', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'show'])->name('admin.settings.about');
                Route::put('/settings/about', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'update'])->name('admin.settings.about.update');
                Route::post('/settings/about/banner/{slot}', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'uploadBanner'])->whereIn('slot', ['home', 'about'])->name('admin.settings.about.banner');
                Route::delete('/settings/about/banner/{slot}', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'removeBanner'])->whereIn('slot', ['home', 'about'])->name('admin.settings.about.banner.remove');
                Route::post('/settings/about/gallery/{section}', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'uploadGallery'])->whereIn('section', ['story', 'shop', 'courses', 'support'])->name('admin.settings.about.gallery');
                Route::delete('/settings/about/gallery/{section}/{index}', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'removeGallery'])->whereIn('section', ['story', 'shop', 'courses', 'support'])->whereNumber('index')->name('admin.settings.about.gallery.remove');
                Route::patch('/settings/about/banner/{slot}/visibility', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'setBannerVisibility'])->whereIn('slot', ['home', 'about'])->name('admin.settings.about.banner.visibility');
                Route::patch('/settings/about/gallery/{section}/{index}/visibility', [\App\Http\Controllers\Admin\AboutSettingsController::class, 'setGalleryVisibility'])->whereIn('section', ['story', 'shop', 'courses', 'support'])->whereNumber('index')->name('admin.settings.about.gallery.visibility');

                Route::get('stock', [StockController::class, 'index'])->name('admin.stock');
                Route::get('stock/movements', [StockController::class, 'movements'])->name('admin.stock.movements');
                Route::get('stock/export', [StockController::class, 'export'])->name('admin.stock.export');

                Route::apiResource('products', AdminProductController::class)->names('admin.products');
                Route::post('products/{product}/stock', [AdminProductController::class, 'adjustStock']);
                Route::get('/course-options', [\App\Http\Controllers\Admin\ProductController::class, 'courseOptions'])->name('admin.products.course-options');
                Route::get('products/{product}/stock-movements', [AdminProductController::class, 'stockMovements']);
                Route::post('products/{product}/image', [AdminProductController::class, 'uploadImage']);
                Route::post('/products/{product}/images', [AdminProductController::class, 'addGalleryImage']);
                Route::delete('/products/{product}/images/{image}', [AdminProductController::class, 'removeGalleryImage']);
                Route::delete('products/{product}/image', [AdminProductController::class, 'removeImage']);

                Route::get('/orders/export', [AdminOrderController::class, 'export'])->name('admin.orders.export');
                Route::post('/orders/manual', [\App\Http\Controllers\Admin\ManualOrderController::class, 'store'])->name('admin.orders.manual');
                Route::get('/orders/{order}/timeline', [\App\Http\Controllers\Admin\OrderNoteController::class, 'timeline'])->name('admin.orders.timeline');
                Route::post('/orders/{order}/notes', [\App\Http\Controllers\Admin\OrderNoteController::class, 'store'])->name('admin.orders.notes.store');
                Route::delete('/orders/{order}/notes/{note}', [\App\Http\Controllers\Admin\OrderNoteController::class, 'destroy'])->name('admin.orders.notes.destroy');
                Route::get('/customers', [\App\Http\Controllers\Admin\CustomerController::class, 'index'])->name('admin.customers');
                Route::get('/customers/export', [\App\Http\Controllers\Admin\CustomerController::class, 'export'])->name('admin.customers.export');
                Route::get('/customers/detail', [\App\Http\Controllers\Admin\CustomerController::class, 'show'])->name('admin.customers.show');
                Route::post('/customers/notes', [\App\Http\Controllers\Admin\CustomerController::class, 'storeNote'])->name('admin.customers.notes.store');
                Route::delete('/customers/notes/{note}', [\App\Http\Controllers\Admin\CustomerController::class, 'destroyNote'])->name('admin.customers.notes.destroy');
                Route::get('/orders', [AdminOrderController::class, 'index']);
                Route::get('/orders/{order}', [AdminOrderController::class, 'show']);
                Route::post('/orders/{order}/mark-paid', [AdminOrderController::class, 'markPaid']);
                Route::post('/orders/bulk-advance', [AdminOrderController::class, 'bulkAdvance']);
                // Page Paiements
                Route::get('/payments', [\App\Http\Controllers\Admin\PaymentController::class, 'index']);
                Route::get('/payments/export', [\App\Http\Controllers\Admin\PaymentController::class, 'export']);
                Route::post('/payments/verify-all', [\App\Http\Controllers\Admin\PaymentController::class, 'verifyAll']);
                Route::get('/payments/{order}/history', [\App\Http\Controllers\Admin\PaymentController::class, 'history']);
                Route::post('/payments/{order}/verify', [\App\Http\Controllers\Admin\PaymentController::class, 'verify']);
                Route::post('/payments/{order}/reject-claim', [\App\Http\Controllers\Admin\PaymentController::class, 'rejectClaim']);
                Route::post('/payments/{order}/refund', [\App\Http\Controllers\Admin\PaymentController::class, 'refund']);
                Route::post('/payments/{order}/resolve-anomaly', [\App\Http\Controllers\Admin\PaymentController::class, 'resolveAnomaly']);
                Route::post('/orders/{order}/cancel', [AdminOrderController::class, 'cancel']);
                Route::post('/orders/{order}/resolve-stock-conflict', [AdminOrderController::class, 'resolveStockConflict']);
                Route::patch('/orders/{order}/fulfillment', [AdminOrderController::class, 'updateFulfillment']);
                Route::patch('/orders/{order}/tracking', [\App\Http\Controllers\Admin\OrderTrackingController::class, 'update']);
                Route::post('/orders/{order}/resend-confirmation', [\App\Http\Controllers\Admin\OrderNotificationController::class, 'resendConfirmation'])->middleware('throttle:10,1');

                Route::get('/invoices', [App\Http\Controllers\Admin\InvoiceController::class, 'index']);
                Route::post('/invoices/zip', [App\Http\Controllers\Admin\InvoiceController::class, 'zip']);
                Route::get('/invoices/{invoice}/pdf', [App\Http\Controllers\Admin\InvoiceController::class, 'pdf']);
            });

            // ===== FORMATION =====
            Route::middleware('admin.scope:formation')->group(function (): void {
                Route::get('/formation-faqs', [\App\Http\Controllers\Admin\FaqController::class, 'index'])->defaults('space', 'formation');
                Route::post('/formation-faqs/reorder', [\App\Http\Controllers\Admin\FaqController::class, 'reorder'])->defaults('space', 'formation');
                Route::post('/formation-faqs', [\App\Http\Controllers\Admin\FaqController::class, 'store'])->defaults('space', 'formation');
                Route::patch('/formation-faqs/{id}', [\App\Http\Controllers\Admin\FaqController::class, 'update'])->whereNumber('id')->defaults('space', 'formation');
                Route::delete('/formation-faqs/{id}', [\App\Http\Controllers\Admin\FaqController::class, 'destroy'])->whereNumber('id')->defaults('space', 'formation');
                Route::get('/formations/dashboard', [FormationsController::class, 'dashboard'])->name('admin.formations.dashboard');
                Route::post('/formations/students', [FormationsController::class, 'storeStudent'])->name('admin.formations.students');
                Route::post('/formations/enroll', [FormationsController::class, 'enroll'])->name('admin.formations.enroll');
        Route::post('/formations/enrollments/{enrollment}/remind', [FormationsController::class, 'remind'])->name('admin.formations.remind');
                Route::get('/formations/users', \App\Http\Controllers\Admin\StudentSearchController::class)->name('admin.formations.users');
                Route::get('/formations/instructors', \App\Http\Controllers\Admin\InstructorListController::class)->name('admin.formations.instructors');

                Route::get('/enrollment-requests', [\App\Http\Controllers\Admin\EnrollmentRequestController::class, 'index'])->name('admin.enrollment-requests');
                Route::post('/enrollment-requests/{id}/decide', [\App\Http\Controllers\Admin\EnrollmentRequestController::class, 'decide'])->whereNumber('id')->name('admin.enrollment-requests.decide');
                Route::get('/enrollment-requests/export', [\App\Http\Controllers\Admin\EnrollmentRequestManageController::class, 'export'])->name('admin.enrollment-requests.export');
                Route::get('/enrollment-requests/list', [\App\Http\Controllers\Admin\EnrollmentRequestManageController::class, 'browse'])->name('admin.enrollment-requests.list');                 Route::get('/enrollment-requests/{id}', [\App\Http\Controllers\Admin\EnrollmentRequestManageController::class, 'show'])->whereNumber('id')->name('admin.enrollment-requests.show');                 Route::post('/enrollment-requests/{id}/resend-decision', [\App\Http\Controllers\Admin\EnrollmentRequestManageController::class, 'resendDecision'])->whereNumber('id')->middleware('throttle:20,1')->name('admin.enrollment-requests.resend-decision');                 Route::post('/enrollment-requests/{id}/resend-link', [\App\Http\Controllers\Admin\EnrollmentRequestManageController::class, 'resendLink'])->whereNumber('id')->middleware('throttle:20,1')->name('admin.enrollment-requests.resend-link');

                Route::get('/enrollments/export', [App\Http\Controllers\Admin\EnrollmentController::class, 'export'])->name('admin.enrollments.export');
        Route::get('/enrollments', [App\Http\Controllers\Admin\EnrollmentController::class, 'index'])->name('admin.enrollments');
                Route::post('/enrollments/{enrollment}/certificate', [App\Http\Controllers\Admin\EnrollmentController::class, 'reissue'])->name('admin.enrollments.certificate');
                Route::post('/enrollments/{enrollment}/quiz/grant-attempt', [\App\Http\Controllers\Admin\EnrollmentController::class, 'grantAttempt'])->name('admin.enrollments.grant-attempt');
                Route::delete('/enrollments/{id}', [EnrollmentRemovalController::class, 'destroy'])->whereNumber('id')->name('admin.enrollments.remove');

                });

            // ===== FORMATEUR (inclus dans formation et super) =====
            Route::middleware(['admin.scope:instructor', \App\Http\Middleware\EnsureCourseAccess::class])->group(function (): void {
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
                Route::patch('/live-sessions/{id}', [App\Http\Controllers\Admin\LiveSessionController::class, 'update'])->whereNumber('id')->name('admin.sessions.update');
        Route::delete('/live-sessions/{id}', [App\Http\Controllers\Admin\LiveSessionController::class, 'destroy'])->name('admin.sessions.destroy');

                Route::post('/courses/{course}/cover', [\App\Http\Controllers\Admin\CourseCoverController::class, 'upload']);
                Route::delete('/courses/{course}/cover', [\App\Http\Controllers\Admin\CourseCoverController::class, 'remove']);
                Route::post('/courses/{course}/duplicate', [AdminCourseController::class, 'duplicate'])->name('admin.courses.duplicate');
                Route::get('/courses/{course}/quiz', [\App\Http\Controllers\Admin\QuizController::class, 'show'])->name('admin.quiz.show');
                Route::put('/courses/{course}/quiz', [\App\Http\Controllers\Admin\QuizController::class, 'update'])->name('admin.quiz.update');
                Route::get('/product-options', [AdminCourseController::class, 'productOptions'])->name('admin.courses.product-options');
        Route::apiResource('courses', AdminCourseController::class)->names('admin.courses');
            });

            // ===== COMMUN (super admin uniquement) =====
            Route::middleware('admin.scope:super')->group(function (): void {
                Route::post('/presentations/{space}/images', [\App\Http\Controllers\Admin\PresentationController::class, 'upload'])->whereIn('space', ['shop', 'formation', 'home']);
                Route::delete('/presentations/{space}/images', [\App\Http\Controllers\Admin\PresentationController::class, 'remove'])->whereIn('space', ['shop', 'formation', 'home']);
                Route::get('/presentations/{space}', [\App\Http\Controllers\Admin\PresentationController::class, 'show'])->whereIn('space', ['shop', 'formation', 'home']);
                Route::put('/presentations/{space}', [\App\Http\Controllers\Admin\PresentationController::class, 'update'])->whereIn('space', ['shop', 'formation', 'home']);
                Route::get('/users', [UserController::class, 'index'])->name('admin.users');
                Route::patch('/users/{user}', [UserController::class, 'update'])->name('admin.users.update');
                Route::get('/activity-logs', [ActivityLogController::class, 'index'])->name('admin.activity');
            });
        });
    });
});

Route::get('/shipping', [\App\Http\Controllers\Storefront\ShippingController::class, 'show']);

if (config('payment.driver') === 'fake' && ! app()->isProduction()) {
    Route::get('/dev/pay/{transaction}', [FakePaymentController::class, 'show'])
        ->name('payment.fake.show');
    Route::post('/dev/pay/{transaction}', [FakePaymentController::class, 'complete'])
        ->name('payment.fake.complete');
}

require __DIR__.'/product-import.php';






