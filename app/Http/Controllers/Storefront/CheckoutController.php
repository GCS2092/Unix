<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Services\CheckoutService;
use App\Services\OrderFulfillmentService;
use App\Services\OrderPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CheckoutController extends Controller
{
    public function store(
        Request $request,
        CheckoutService $checkout,
        OrderPaymentService $payments,
        OrderFulfillmentService $fulfillment,
    ): JsonResponse {
        $rules = [
            'guest_name' => ['nullable', 'string', 'max:255'],
        ];

        if ($request->user() === null) {
            $rules['guest_email'] = ['required', 'email', 'max:255'];
        } else {
            $rules['guest_email'] = ['nullable', 'email', 'max:255'];
        }

        $validated = $request->validate($rules);

        try {
            $order = $checkout->createOrder(
                $request->user(),
                $validated['guest_email'] ?? null,
                $validated['guest_name'] ?? null,
            );
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
