<?php

namespace App\Http\Controllers\Storefront;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CheckoutReturnController extends Controller
{
    public function __invoke(Request $request): RedirectResponse
    {
        $transactionId = collect([
            $request->input('transaction_id'),
            $request->input('cpm_trans_id'),
        ])->first(fn ($value) => is_string($value) && $value !== '', '');

        $target = rtrim((string) config('frontend.url'), '/').'/commande/retour';

        if ($transactionId !== '') {
            $target .= '?'.http_build_query(['transaction_id' => $transactionId]);
        }

        return redirect()->away($target, 303);
    }
}