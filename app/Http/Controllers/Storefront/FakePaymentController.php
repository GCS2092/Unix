<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderPaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class FakePaymentController extends Controller
{
    public function show(string $transaction): Response
    {
        $order = Order::query()->where('payment_transaction_id', $transaction)->firstOrFail();
        $amount = e(number_format((int) $order->total, 0, ',', ' ').' '.($order->currency === 'XOF' ? 'FCFA' : $order->currency));
        $action = e(route('payment.fake.complete', ['transaction' => $transaction]));
        $id = e((string) $order->id);

        $html = <<<HTML
<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Paiement simulé</title>
<style>
body{font-family:system-ui,sans-serif;background:#f3f4f6;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#fff;padding:2rem;border-radius:1rem;max-width:22rem;width:90%;text-align:center;box-shadow:0 4px 20px #0001}
.tag{background:#fef3c7;color:#92400e;border-radius:9999px;padding:.2rem .7rem;font-size:.75rem;font-weight:600}
button{width:100%;padding:.8rem;margin-top:.7rem;border:0;border-radius:.6rem;font-size:1rem;font-weight:600;cursor:pointer;color:#fff}
.ok{background:#16a34a}.ko{background:#dc2626}
</style></head><body><div class="card">
<span class="tag">SIMULATION - développement</span>
<h1>Commande n°{$id}</h1><p style="font-size:1.5rem;font-weight:700">{$amount}</p>
<form method="post" action="{$action}"><button class="ok" name="result" value="accepted">Payer (succès)</button>
<button class="ko" name="result" value="refused">Échouer</button></form>
</div></body></html>
HTML;

        return response($html);
    }

    public function complete(Request $request, string $transaction, OrderPaymentService $payments): RedirectResponse
    {
        Order::query()->where('payment_transaction_id', $transaction)->firstOrFail();

        $status = $request->input('result') === 'accepted' ? 'ACCEPTED' : 'REFUSED';
        Cache::put("fake_payment:{$transaction}", $status, now()->addDay());

        // Même chemin que le vrai webhook ; le nonce évite qu'il soit ignoré comme doublon
        $payments->handleCinetPayNotification([
            'cpm_trans_id' => $transaction,
            'fake_nonce' => (string) Str::uuid(),
        ]);

        return redirect()->route('cinetpay.return', ['transaction_id' => $transaction]);
    }
}