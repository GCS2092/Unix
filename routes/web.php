<?php

use App\Models\Order;
use App\Services\CinetPayService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/checkout/return', function (Request $request, CinetPayService $cinetPay) {
    $transactionId = (string) ($request->query('transaction_id')
        ?? $request->query('cpm_trans_id')
        ?? '');

    $order = $transactionId !== ''
        ? Order::query()->where('payment_transaction_id', $transactionId)->first()
        : null;

    $status = null;
    if ($transactionId !== '' && config('services.cinetpay.api_key') !== '') {
        try {
            $check = $cinetPay->checkTransactionStatus($transactionId);
            $status = data_get($check, 'data.status');
        } catch (\Throwable) {
            $status = 'UNKNOWN';
        }
    }

    return view('checkout.return', [
        'order' => $order,
        'transactionId' => $transactionId,
        'status' => $status,
    ]);
})->name('cinetpay.return');
