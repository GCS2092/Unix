<?php

namespace App\Providers;

use App\Services\CinetPayService;
use App\Services\FakePaymentService;
use App\Services\PaymentGateway;
use Illuminate\Support\ServiceProvider;

class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PaymentGateway::class, function ($app) {
            $useFake = config('payment.driver') === 'fake' && ! $app->runningUnitTests();

            if ($useFake) {
                if ($app->isProduction()) {
                    throw new \RuntimeException('PAYMENT_DRIVER=fake est interdit en production.');
                }

                return $app->make(FakePaymentService::class);
            }

            return $app->make(CinetPayService::class);
        });
    }
}