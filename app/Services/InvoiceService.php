<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Order;
use App\Models\Product;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoiceService
{
    public function number(Order $order): string
    {
        return 'FAC-'.str_pad((string) $order->id, 6, '0', STR_PAD_LEFT);
    }

    public function outputInvoice(\App\Models\Invoice $invoice): string
    {
        return Pdf::loadView('invoices.document', [
            'invoice' => $invoice,
            'lang' => $invoice->locale === 'en' ? 'en' : 'fr',
        ])->setPaper('a4')->output();
    }

    public function outputCreditNote(\App\Models\CreditNote $note): string
    {
        return Pdf::loadView('invoices.credit-note', [
            'note' => $note,
            'lang' => $note->locale === 'en' ? 'en' : 'fr',
        ])->setPaper('a4')->output();
    }
}