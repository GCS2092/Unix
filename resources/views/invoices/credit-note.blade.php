@php
    $s = (array) ($note->seller ?? []);
    $fr = ($lang ?? 'fr') !== 'en';
    $T = fn ($a, $b) => $fr ? $a : $b;
    $brand = \App\Support\Brand::color('shop');
    $accent = \App\Support\Brand::accent('shop');
    $name = trim((string) ($s['name'] ?? '')) ?: (string) config('app.name');
    $logoPath = public_path('brand/logo-betcc.png');
    $logo = is_file($logoPath) ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath)) : null;
    $cur = $note->currency === 'XOF' ? 'FCFA' : (string) $note->currency;
    $money = fn ($n) => number_format((int) $n, 0, ',', "\u{00A0}")."\u{00A0}".$cur;
    $total = (int) $note->total;
    $rate = (int) ($s['vat_rate'] ?? 0);
    $vatOn = ! empty($s['vat_enabled']) && $rate > 0;
    $vat = $vatOn ? (int) round($total - $total / (1 + $rate / 100)) : 0;
    $invoice = $note->invoice;
    $sellerLines = array_filter([
        $s['address'] ?? null,
        ! empty($s['phone']) ? $T('Tél : ', 'Phone: ').$s['phone'] : null,
        $s['email'] ?? null,
        ! empty($s['ninea']) ? 'NINEA : '.$s['ninea'] : null,
        ! empty($s['rccm']) ? 'RCCM : '.$s['rccm'] : null,
    ]);
@endphp
<!DOCTYPE html>
<html lang="{{ $fr ? 'fr' : 'en' }}">
<head>
<meta charset="utf-8">
<title>{{ $note->number }}</title>
<style>
    @page { margin: 0; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 10.5px; color: #1f2430; margin: 0; }
    table { border-collapse: collapse; width: 100%; }
    .bar { background: {{ $brand }}; height: 10px; } .bar2 { background: #dc2626; height: 3px; }
    .wrap { padding: 26px 40px 0 40px; }
    .muted { color: #6b7280; }
    .name { font-size: 17px; font-weight: bold; color: {{ $brand }}; }
    .title { font-size: 22px; font-weight: bold; color: #dc2626; text-align: right; letter-spacing: 1px; }
    .box { border: 1px solid #e5e7eb; background: #f8f9fc; padding: 10px 12px; }
    .label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; font-weight: bold; margin-bottom: 4px; }
    .items { margin-top: 20px; }
    .items th { background: {{ $brand }}; color: #fff; font-size: 9px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
    .items td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; }
    .r { text-align: right; } .c { text-align: center; }
    .tot td { padding: 5px 10px; }
    .grand td { background: #dc2626; color: #fff; font-size: 13px; font-weight: bold; padding: 9px 10px; }
    .foot { position: fixed; bottom: 0; left: 0; right: 0; padding: 0 40px 18px 40px; font-size: 8.5px; color: #6b7280; text-align: center; }
    .foot .line { border-top: 1px solid #e5e7eb; padding-top: 8px; }
</style>
</head>
<body>
<div class="bar"></div><div class="bar2"></div>
<div class="wrap">
    <table><tr>
        <td style="width:55%; vertical-align:top;">
            @if ($logo)<img src="{{ $logo }}" alt="{{ $name }}" style="height:54px; margin-bottom:6px;"><br>@endif
            <span class="name">{{ $name }}</span><br>
            @foreach ($sellerLines as $line)<span class="muted">{{ $line }}</span><br>@endforeach
        </td>
        <td style="width:45%; vertical-align:top;">
            <div class="title">{{ $T('AVOIR', 'CREDIT NOTE') }}</div>
            <div class="r" style="font-size:12px; font-weight:bold;">{{ $note->number }}</div>
            <div class="r muted" style="margin-top:4px;">{{ $T('Émis le ', 'Issued on ') }}{{ $note->issued_at?->format('d/m/Y') }}</div>
            @if ($invoice)<div class="r muted">{{ ($note->kind ?? '') === 'refund' ? $T('Remboursement sur la facture ', 'Refund on invoice ') : $T('Annule la facture ', 'Cancels invoice ') }}{{ $invoice->number }}</div>@endif
        </td>
    </tr></table>

    <table style="margin-top:22px;"><tr>
        <td style="width:52%; padding-right:10px; vertical-align:top;">
            <div class="box">
                <div class="label">{{ $T('Client', 'Customer') }}</div>
                <strong style="font-size:12px;">{{ $note->customer_name ?: $T('Client', 'Customer') }}</strong><br>
                @if ($note->customer_address)<span class="muted">{{ $note->customer_address }}</span>@endif
            </div>
        </td>
        <td style="width:48%; vertical-align:top;">
            <div class="box">
                <div class="label">{{ $T('Motif', 'Reason') }}</div>
                {{ $note->reason ?: (($note->kind ?? '') === 'refund' ? $T('Remboursement', 'Refund') : $T('Annulation de la commande', 'Order cancelled')) }}
            </div>
        </td>
    </tr></table>

    <table class="items">
        <thead><tr>
            <th style="width:50%;">{{ $T('Désignation', 'Description') }}</th>
            <th class="c" style="width:10%;">{{ $T('Qté', 'Qty') }}</th>
            <th class="r" style="width:20%;">{{ $T('Prix unitaire', 'Unit price') }}</th>
            <th class="r" style="width:20%;">{{ $T('Total', 'Total') }}</th>
        </tr></thead>
        <tbody>
        @foreach ((array) $note->items as $line)
            <tr>
                <td>{{ $line['name'] ?? '' }}</td>
                <td class="c">{{ (int) ($line['quantity'] ?? 1) }}</td>
                <td class="r">{{ $money($line['unit_price'] ?? 0) }}</td>
                <td class="r">{{ $money($line['line_total'] ?? 0) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>

    <table style="margin-top:10px;"><tr>
        <td style="width:52%;"></td>
        <td style="width:48%;">
            <table class="tot">
                <tr><td class="muted">{{ $T('Sous-total', 'Subtotal') }}</td><td class="r">{{ $money($note->subtotal) }}</td></tr>
                <tr><td class="muted">{{ $T('Livraison', 'Delivery') }}</td><td class="r">{{ $money($note->delivery_fee) }}</td></tr>
                @if ($vatOn)
                    <tr><td class="muted">{{ $T('Total HT', 'Total excl. VAT') }}</td><td class="r">{{ $money($total - $vat) }}</td></tr>
                    <tr><td class="muted">{{ $T('TVA', 'VAT') }} {{ $rate }}%</td><td class="r">{{ $money($vat) }}</td></tr>
                @endif
            </table>
            <table><tr class="grand"><td>{{ $T('TOTAL À RESTITUER', 'TOTAL CREDITED') }}{{ $vatOn ? ' TTC' : '' }}</td><td class="r">- {{ $money($total) }}</td></tr></table>
        </td>
    </tr></table>
</div>
<div class="foot"><div class="line">
    {{ ! empty($s['footer']) ? $s['footer'] : (($note->kind ?? '') === 'refund' ? $T('Cet avoir rembourse tout ou partie de la facture indiquée.', 'This credit note refunds all or part of the invoice shown.') : $T('Cet avoir annule la facture indiquée.', 'This credit note cancels the invoice shown.')) }}<br>
    {{ implode(' - ', array_filter([$name, ! empty($s['ninea']) ? 'NINEA '.$s['ninea'] : null, ! empty($s['rccm']) ? 'RCCM '.$s['rccm'] : null])) }}
</div></div>
</body>
</html>