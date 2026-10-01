<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\InvoiceService;
use Illuminate\Http\Response;

class InvoiceController extends Controller
{
    public function download(Order $order, InvoiceService $invoices): Response
    {
        // Même règle que GET /orders/{order} : le propriétaire ou un admin
        $this->authorize('view', $order);

        abort_unless($order->isPaid(), 422, 'La facture n\'est disponible que pour les commandes payées.');

        return response($invoices->output($order), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="facture-'.$order->id.'.pdf"',
        ]);
    }
}