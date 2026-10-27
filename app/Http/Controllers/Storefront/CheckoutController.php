<?php

namespace App\Http\Controllers\Storefront;

use App\Exceptions\InsufficientStockException;
use App\Http\Controllers\Controller;
use App\Http\Requests\CheckoutRequest;
use App\Http\Resources\OrderResource;
use App\Services\CheckoutService;
use App\Services\OrderPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class CheckoutController extends Controller
{
    public function store(
        CheckoutRequest $request,
        CheckoutService $checkout,
        OrderPaymentService $payments,
    ): JsonResponse {
        // Anti double envoi : une cle par tentative, reservee 120 s (atomique)
        $idem = $request->input('idempotency_key');
        if (is_string($idem) && preg_match('/^[A-Za-z0-9-]{16,64}$/', $idem) === 1) {
            $lock = 'checkout-idem:'.sha1(($request->user()?->id ?? $request->ip()).'|'.$idem);
            if (! Cache::add($lock, 1, 120)) {
                return response()->json(['message' => app()->getLocale() === 'en'
                    ? 'This order is already being processed.'
                    : 'Cette commande est deja en cours de traitement.'], 409);
            }
        }
        try {
            // La langue est enregistree DANS la creation de la commande (une seule ecriture atomique).
            $order = $checkout->createOrder(
                $request->user(),
                $request->validated() + ['locale' => app()->getLocale()],
            );
        } catch (InsufficientStockException $exception) {
            return response()->json($exception->toResponseData(), 422);
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        // Un invite doit toujours pouvoir retrouver sa commande, meme si le paiement en ligne est indisponible.
        $trackToken = $order->user_id === null ? $order->ensureTrackingToken() : null;

        if (config('payment.manual')) {
            return response()->json([
                'data' => OrderResource::make($order),
                'payment_url' => null,
                'transaction_id' => $order->payment_transaction_id,
                'payment_pending_manual' => true,
                'track_token' => $trackToken,
            ], 201);
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
                'track_token' => $trackToken,
            ], 201);
        }

        return response()->json([
            'data' => OrderResource::make($order),
            'payment_url' => $payment['payment_url'],
            'transaction_id' => $payment['transaction_id'],
        ], 201);
    }
}
