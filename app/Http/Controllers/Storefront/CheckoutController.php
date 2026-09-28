<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\CheckoutService;
use App\Services\OrderFulfillmentService;
use App\Services\OrderPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class CheckoutController extends Controller
{
    public function store(
        CheckoutRequest $request,
        CheckoutService $checkout,
        OrderPaymentService $payments,
        OrderFulfillmentService $fulfillment,
    ): JsonResponse {
        try {
            $order = $checkout->createOrder($request->user(), $request->validated());
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        try {
            $payment = $payments->initiatePayment($order);
        } catch (\RuntimeException $exception) {
            Log::critical('Echec initiation paiement apres creation de commande', [
                'order_id' => $order->id,
                'error' => $exception->getMessage(),
            ]);

            $fulfillment->markFailed($order);

            return response()->json([
                'message' => 'La commande a ete creee mais le paiement n\'a pas pu etre initie. Veuillez reessayer.',
                'order_id' => $order->id,
            ], 422);
        }

        return response()->json([
            'data' => OrderResource::make($order),
            'payment_url' => $payment['payment_url'],
            'transaction_id' => $payment['transaction_id'],
        ], 201);
    }
}