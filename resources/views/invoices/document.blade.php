@php
    $s = (array) ($invoice->seller ?? []);
    $fr = ($lang ?? 'fr') !== 'en';
    $T = fn ($a, $b) => $fr ? $a : $b;
    $brand = \App\Support\Brand::color('shop');
    $accent = \App\Support\Brand::accent('shop');
    $name = trim((string) ($s['name'] ?? '')) ?: (string) config('app.name');
    $logoPath = public_path('brand/logo-betcc.png');
    $logo = is_file($logoPath) ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath)) : null;
    $cur = $invoice->currency === 'XOF' ? 'FCFA' : (string) $invoice->currency;
    $money = fn ($n) => number_format((int) $n, 0, ',', "\u{00A0}")."\u{00A0}".$cur;
    $total = (int) $invoice->total;
    $delivery = (int) $invoice->delivery_fee;
    $rate = (int) ($s['vat_rate'] ?? 0);
    $vatOn = ! empty($s['vat_enabled']) && $rate > 0;
    $vat = $vatOn ? (int) round($total - $total / (1 + $rate / 100)) : 0;
    $words = null;
    if (class_exists(\NumberFormatter::class)) {
        try {
            $nf = new \NumberFormatter($fr ? 'fr' : 'en', \NumberFormatter::SPELLOUT);
            $w = $nf->format($total);
            $words = $w ? mb_strtoupper(mb_substr($w, 0, 1)).mb_substr($w, 1).' '.($invoice->currency === 'XOF' ? ($fr ? 'francs CFA' : 'CFA francs') : $cur) : null;
        } catch (\Throwable $e) { $words = null; }
    }
    $order = $invoice->order;
    $method = $order && $order->payment_method ? ucfirst(str_replace('_', ' ', (string) $order->payment_method)) : null;
    $payRef = $order ? ($order->payment_reference ?: null) : null;
    $cancelled = $invoice->status === 'cancelled';
    $sellerLines = array_filter([
        $s['address'] ?? null,
        ! empty($s['phone']) ? $T('Tél : ', 'Phone: ').$s['phone'] : null,
        $s['email'] ?? null,
        ! empty($s['ninea']) ? 'NINEA : '.$s['ninea'] : null,
        ! empty($s['rccm']) ? 'RCCM : '.$s['rccm'] : null,
    ]);
    $custLines = array_filter([
        $invoice->customer_address,
        $invoice->customer_phone ? $T('Tél : ', 'Phone: ').$invoice->customer_phone : null,
        $invoice->customer_email,
    ]);
    $legal = implode(' - ', array_filter([
        $name,
        ! empty($s['ninea']) ? 'NINEA '.$s['ninea'] : null,
        ! empty($s['rccm']) ? 'RCCM '.$s['rccm'] : null,
    ]));
@endphp
<!DOCTYPE html>
<html lang="{{ $fr ? 'fr' : 'en' }}">
<head>
<meta charset="utf-8">
<title>{{ $invoice->number }}</title>
<style>
    @page { margin: 0; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 10.5px; color: #1f2430; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    .bar { background: {{ $brand }}; height: 10px; }
    .bar2 { background: {{ $accent }}; height: 3px; }
    .wrap { padding: 26px 40px 0 40px; }
    .muted { color: #6b7280; }
    .name { font-size: 17px; font-weight: bold; color: {{ $brand }}; }
    .title { font-size: 24px; font-weight: bold; color: {{ $brand }}; text-align: right; letter-spacing: 1px; }
    .num { text-align: right; font-size: 12px; font-weight: bold; }
    .box { border: 1px solid #e5e7eb; background: #f8f9fc; padding: 10px 12px; }
    .label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: bold; margin-bottom: 4px; }
    .items { margin-top: 20px; }
    .items th { background: {{ $brand }}; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; padding: 8px 10px; text-align: left; }
    .items td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .r { text-align: right; }
    .c { text-align: center; }
    .tot td { padding: 5px 10px; }
    .grand td { background: {{ $brand }}; color: #fff; font-size: 13px; font-weight: bold; padding: 9px 10px; }
    .stamp { border: 2px solid #dc2626; color: #dc2626; font-weight: bold; font-size: 14px; padding: 4px 12px; text-align: center; }
    .paid { color: #047857; font-weight: bold; }
    .foot { position: fixed; bottom: 0; left: 0; right: 0; padding: 0 40px 18px 40px; font-size: 8.5px; color: #6b7280; text-align: center; }
    .foot .line { border-top: 1px solid #e5e7eb; padding-top: 8px; }
</style>
</head>
<body>
<div class="bar"></div><div class="bar2"></div>
<div class="wrap">
    <table>
        <tr>
            <td style="width:55%; vertical-align:top;">
                @if ($logo)<img src="{{ $logo }}" alt="{{ $name }}" style="height:54px; margin-bottom:6px;"><br>@endif
                <span class="name">{{ $name }}</span><br>
                @foreach ($sellerLines as $line)<span class="muted">{{ $line }}</span><br>@endforeach
            </td>
            <td style="width:45%; vertical-align:top;">
                <div class="title">{{ $T('FACTURE', 'INVOICE') }}</div>
                <div class="num">{{ $invoice->number }}</div>
                <div class="r muted" style="margin-top:4px;">{{ $T('Émise le ', 'Issued on ') }}{{ $invoice->issued_at?->format('d/m/Y') }}</div>
                @if ($order && $order->public_ref)<div class="r muted">{{ $T('Commande ', 'Order ') }}{{ $order->public_ref }}</div>@endif
                @if ($cancelled)<div style="margin-top:8px;" class="stamp">{{ $T('ANNULÉE', 'CANCELLED') }}</div>@endif
            </td>
        </tr>
    </table>

    <table style="margin-top:22px;">
        <tr>
            <td style="width:52%; padding-right:10px; vertical-align:top;">
                <div class="box">
                    <div class="label">{{ $T('Facturé à', 'Billed to') }}</div>
                    <strong style="font-size:12px;">{{ $invoice->customer_name ?: $T('Client', 'Customer') }}</strong><br>
                    @foreach ($custLines as $line)<span class="muted">{{ $line }}</span><br>@endforeach
                </div>
            </td>
            <td style="width:48%; vertical-align:top;">
                <div class="box">
                    <div class="label">{{ $T('Paiement', 'Payment') }}</div>
                    @if (! $cancelled)<span class="paid">{{ $T('Payée', 'Paid') }}</span><br>@endif
                    @if ($method)<span class="muted">{{ $T('Mode : ', 'Method: ') }}</span>{{ $method }}<br>@endif
                    @if ($payRef)<span class="muted">{{ $T('Référence : ', 'Reference: ') }}</span>{{ $payRef }}<br>@endif
                    @if ($order && $order->paid_at)<span class="muted">{{ $T('Le ', 'On ') }}</span>{{ $order->paid_at->format('d/m/Y') }}@endif
                </div>
            </td>
        </tr>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th style="width:50%;">{{ $T('Désignation', 'Description') }}</th>
                <th class="c" style="width:10%;">{{ $T('Qté', 'Qty') }}</th>
                <th class="r" style="width:20%;">{{ $T('Prix unitaire', 'Unit price') }}</th>
                <th class="r" style="width:20%;">{{ $T('Total', 'Total') }}</th>
            </tr>
        </thead>
        <tbody>
            @foreach ((array) $invoice->items as $line)
                <tr>
                    <td>{{ $line['name'] ?? '' }}</td>
                    <td class="c">{{ (int) ($line['quantity'] ?? 1) }}</td>
                    <td class="r">{{ $money($line['unit_price'] ?? 0) }}</td>
                    <td class="r"><strong>{{ $money($line['line_total'] ?? 0) }}</strong></td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table style="margin-top:10px;">
        <tr>
            <td style="width:52%;"></td>
            <td style="width:48%;">
                <table class="tot">
                    <tr><td class="muted">{{ $T('Sous-total', 'Subtotal') }}</td><td class="r">{{ $money($invoice->subtotal) }}</td></tr>
                    <tr><td class="muted">{{ $T('Livraison', 'Delivery') }}</td><td class="r">{{ $delivery > 0 ? $money($delivery) : $T('Offerte / sans objet', 'Free / n.a.') }}</td></tr>
                    @if ($vatOn)<tr><td class="muted">{{ $T('Total HT', 'Total excl. VAT') }}</td><td class="r">{{ $money($total - $vat) }}</td></tr><tr><td class="muted">{{ $T('TVA', 'VAT') }} {{ $rate }}%</td><td class="r">{{ $money($vat) }}</td></tr>@endif
                </table>
                <table><tr class="grand"><td>{{ $T('TOTAL À PAYER', 'TOTAL DUE') }}{{ $vatOn ? ' TTC' : '' }}</td><td class="r">{{ $money($total) }}</td></tr></table>
            </td>
        </tr>
    </table>

    @if ($words)
        <p style="margin-top:14px;"><span class="muted">{{ $T('Arrêtée la présente facture à la somme de : ', 'Amount in words: ') }}</span><strong>{{ $words }}</strong></p>
    @endif
    @if (! $vatOn)
        <p class="muted" style="font-size:9px;">{{ $T('TVA non applicable.', 'VAT not applicable.') }}</p>
    @endif
</div>

<div class="foot">
    <div class="line">
        {{ ! empty($s['footer']) ? $s['footer'] : $T('Merci pour votre confiance.', 'Thank you for your trust.') }}<br>
        {{ $legal }}
    </div>
</div>
</body>
</html>