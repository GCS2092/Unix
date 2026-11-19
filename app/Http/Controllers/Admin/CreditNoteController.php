<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CreditNote;
use App\Models\Order;
use App\Services\InvoiceService;
use Illuminate\Http\Response;

class CreditNoteController extends Controller
{
    public function pdf(CreditNote $creditNote, InvoiceService $invoices): Response
    {
        $this->authorize('manage', Order::class);

        return response($invoices->outputCreditNote($creditNote), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$creditNote->number.'.pdf"',
        ]);
    }
}