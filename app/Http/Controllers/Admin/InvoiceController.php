<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Order;
use App\Services\InvoiceService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class InvoiceController extends Controller
{
    private const ZIP_LIMIT = 200;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('manage', Order::class);

        $request->validate([
            'status' => ['nullable', 'in:issued,cancelled'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $base = $this->filtered($request);

        $s = (clone $base)->toBase()->selectRaw(
            "COUNT(*) as n,
            SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued_count,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
            COALESCE(SUM(CASE WHEN status = 'issued' THEN total ELSE 0 END), 0) as issued_total",
        )->first();

        $invoices = $base->latest('issued_at')->latest('id')->paginate(25);

        return response()->json([
            'data' => $invoices->getCollection()->map(fn (Invoice $i): array => [
                'id' => $i->id,
                'number' => $i->number,
                'status' => $i->status,
                'issued_at' => $i->issued_at?->toIso8601String(),
                'customer_name' => $i->customer_name,
                'customer_email' => $i->customer_email,
                'order_id' => $i->order_id,
                'currency' => $i->currency,
                'total' => (int) $i->total,
                'filename' => $this->filename($i),
            ])->values(),
            'summary' => [
                'count' => (int) ($s->n ?? 0),
                'issued_count' => (int) ($s->issued_count ?? 0),
                'cancelled_count' => (int) ($s->cancelled_count ?? 0),
                'issued_total' => (int) ($s->issued_total ?? 0),
                'zip_limit' => self::ZIP_LIMIT,
            ],
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'last_page' => $invoices->lastPage(),
                'total' => $invoices->total(),
            ],
        ]);
    }

    public function pdf(Invoice $invoice, InvoiceService $invoices): Response
    {
        $this->authorize('manage', Order::class);

        return response($invoices->outputInvoice($invoice), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$this->filename($invoice).'"',
        ]);
    }

    /** ZIP des factures sélectionnées (ids) ou, sans sélection, de tous les résultats filtrés. */
    public function zip(Request $request, InvoiceService $invoices): SymfonyResponse
    {
        $this->authorize('manage', Order::class);

        $request->validate([
            'ids' => ['nullable', 'array', 'max:'.self::ZIP_LIMIT],
            'ids.*' => ['integer'],
            'status' => ['nullable', 'in:issued,cancelled'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $ids = array_values(array_filter((array) $request->input('ids', [])));
        $query = $ids !== [] ? Invoice::query()->whereIn('id', $ids) : $this->filtered($request);

        $count = (clone $query)->count();
        if ($count === 0) {
            return response()->json(['message' => 'Aucune facture à télécharger avec ces critères.'], 422);
        }
        if ($count > self::ZIP_LIMIT) {
            return response()->json([
                'message' => "Trop de factures ($count) : maximum ".self::ZIP_LIMIT.' par téléchargement. Réduis la période ou le filtre.',
            ], 422);
        }

        $list = $query->orderBy('issued_at')->orderBy('id')->get();

        @set_time_limit(300);

        $path = tempnam(sys_get_temp_dir(), 'fac');
        $zip = new \ZipArchive();
        if ($zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return response()->json(['message' => 'Impossible de créer l\'archive.'], 500);
        }

        foreach ($list as $invoice) {
            $zip->addFromString($this->filename($invoice), $invoices->outputInvoice($invoice));
        }
        $zip->addFromString('journal-factures.csv', $this->journal($list));
        $zip->close();

        return response()
            ->download($path, 'factures-'.now()->format('Y-m-d').'.zip', ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend(true);
    }

    private function filtered(Request $request): Builder
    {
        $q = trim((string) $request->input('q', ''));
        $status = (string) $request->input('status', '');
        $from = $request->input('from');
        $to = $request->input('to');

        return Invoice::query()
            ->when(in_array($status, ['issued', 'cancelled'], true), fn ($w) => $w->where('status', $status))
            ->when($from, fn ($w) => $w->where('issued_at', '>=', Carbon::parse((string) $from)->startOfDay()))
            ->when($to, fn ($w) => $w->where('issued_at', '<=', Carbon::parse((string) $to)->endOfDay()))
            ->when($q !== '', function ($w) use ($q): void {
                $like = '%'.mb_strtolower(addcslashes($q, '%_\\')).'%';
                $id = ltrim($q, '#');
                $w->where(function ($x) use ($like, $id): void {
                    if (ctype_digit($id)) {
                        $x->orWhere('order_id', (int) $id);
                    }
                    $x->orWhereRaw('LOWER(number) LIKE ?', [$like])
                        ->orWhereRaw("LOWER(COALESCE(customer_name, '')) LIKE ?", [$like])
                        ->orWhereRaw("LOWER(COALESCE(customer_email, '')) LIKE ?", [$like]);
                });
            });
    }

    /** FAC-2026-000001_Awa-Diop.pdf : sans accents ni caractères interdits. */
    private function filename(Invoice $i): string
    {
        $name = Str::of(Str::ascii((string) $i->customer_name))
            ->replaceMatches('/[^A-Za-z0-9]+/', '-')
            ->trim('-')
            ->limit(40, '')
            ->trim('-')
            ->toString();

        return $i->number.($name !== '' ? '_'.$name : '').'.pdf';
    }

    /** @param iterable<Invoice> $list */
    private function journal(iterable $list): string
    {
        $cell = function (mixed $v): string {
            $s = (string) ($v ?? '');

            return $s !== '' && in_array($s[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$s : $s;
        };

        $out = fopen('php://temp', 'w+');
        $put = fn (array $row) => fputcsv($out, $row, ';', '"', '\\');

        $put(['Numero', 'Date', 'Client', 'Email', 'Telephone', 'Commande', 'Devise', 'Sous-total', 'Livraison', 'Total', 'Statut', 'Fichier']);

        foreach ($list as $i) {
            $put([
                $i->number,
                $i->issued_at?->format('Y-m-d H:i'),
                $cell($i->customer_name),
                $cell($i->customer_email),
                $cell($i->customer_phone),
                $i->order_id,
                $i->currency,
                $i->subtotal,
                $i->delivery_fee,
                $i->total,
                $i->status === 'cancelled' ? 'annulee' : 'emise',
                $this->filename($i),
            ]);
        }

        rewind($out);
        $csv = "\xEF\xBB\xBF".stream_get_contents($out);
        fclose($out);

        return $csv;
    }
}