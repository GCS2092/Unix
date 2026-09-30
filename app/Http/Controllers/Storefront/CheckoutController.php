<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\CheckoutService;
use App\Services\OrderPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class CheckoutController extends Controller
{
    public function store(
        CheckoutRequest $request,
        CheckoutService $checkout,
        OrderPaymentService $payments,
    ): JsonResponse {
        try {
            $order = $checkout->createOrder($request->user(), $request->validated());
            $order->update(['locale' => app()->getLocale()]);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        try {
            $payment = $payments->initiatePayment($order);
        } catch (\Throwable $exception) {
            // Paiement indisponible : la commande reste en attente (reservee),
            // l'admin la valide manuellement apres verification du paiement.
            Log::error('Paiement indisponible, commande laissee en attente pour validation manuelle', [
                'order_id' => $order->id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'data' => OrderResource::make($order),
                'payment_url' => null,
                'transaction_id' => $order->payment_transaction_id,
                'payment_pending_manual' => true,
            ], 201);
        }

        return response()->json([
            'data' => OrderResource::make($order),
            'payment_url' => $payment['payment_url'],
            'transaction_id' => $payment['transaction_id'],
        ], 201);
    }
}