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

    public function output(Order $order): string
    {
        $order->loadMissing('items.itemable', 'user');

        $lines = $order->items->map(function ($item): array {
            $model = $item->itemable;
            $name = match (true) {
                $model instanceof Product => $model->localizedName(),
                $model instanceof Course => $model->title,
                default => 'Article',
            };

            return [
                'name' => $name,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'line_total' => $item->line_total,
            ];
        });

        return Pdf::loadView('invoices.order', [
            'order' => $order,
            'number' => $this->number($order),
            'lines' => $lines,
            'company' => config('invoice'),
            'lang' => $order->locale === 'en' ? 'en' : 'fr',
        ])->setPaper('a4')->output();
    }
}