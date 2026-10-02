<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use App\Services\InvoiceIssuer;
use App\Services\InvoiceService;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class InvoiceController extends Controller
{
    public function download(Order $order, InvoiceService $invoices, InvoiceIssuer $issuer): Response
    {
        // Même règle que GET /orders/{order} : le propriétaire ou un admin
        $this->authorize('view', $order);

        abort_unless($order->isPaid(), 422, 'La facture n\'est disponible que pour les commandes payées.');

        $invoice = Invoice::query()->where('order_id', $order->id)->first()
            ?? DB::transaction(fn (): Invoice => $issuer->issueFor($order));

        return response($invoices->outputInvoice($invoice), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$invoice->number.'.pdf"',
        ]);
    }
}