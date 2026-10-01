@php
    $en = $lang === 'en';
    $money = fn ($a) => number_format((int) $a, 0, ',', ' ').' '.($order->currency === 'XOF' ? 'FCFA' : $order->currency);
    $subtotal = $order->subtotal ?: $lines->sum('line_total');
    $customerName = $order->user?->name ?? $order->guest_name ?? '—';
    $customerEmail = $order->user?->email ?? $order->guest_email;
    $address = trim(implode(', ', array_filter([$order->address, $order->district, $order->city])));
@endphp
<!DOCTYPE html>
<html lang="{{ $lang }}">
<head>
<meta charset="utf-8">
<style>
    body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #0f172a; }
    h1 { font-size: 22px; margin: 0; color: #0f766e; }
    .muted { color: #64748b; }
    .row { width: 100%; margin-bottom: 24px; }
    .row td { vertical-align: top; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; color: #64748b; }
    table.items td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .r { text-align: right; }
    .totals { width: 45%; margin-left: 55%; margin-top: 16px; border-collapse: collapse; }
    .totals td { padding: 5px 8px; }
    .grand td { border-top: 2px solid #0f766e; font-size: 13px; font-weight: bold; color: #0f766e; }
    .paid { display: inline-block; margin-top: 6px; padding: 3px 10px; border: 1px solid #10b981; color: #10b981; font-weight: bold; }
    .foot { margin-top: 40px; text-align: center; font-size: 10px; color: #64748b; }
</style>
</head>
<body>
<table class="row">
    <tr>
        <td>
            <h1>{{ $company['name'] }}</h1>
            <div class="muted">
                {{ $company['address'] }}<br>
                @if ($company['phone']) {{ $company['phone'] }}<br> @endif
                @if ($company['email']) {{ $company['email'] }}<br> @endif
                @if ($company['ninea']) NINEA : {{ $company['ninea'] }} @endif
            </div>
        </td>
        <td class="r">
            <div style="font-size:18px;font-weight:bold;">{{ $en ? 'INVOICE' : 'FACTURE' }}</div>
            <div>{{ $number }}</div>
            <div class="muted">{{ $en ? 'Date' : 'Date' }} : {{ ($order->paid_at ?? $order->created_at)->format('d/m/Y') }}</div>
            <div class="paid">{{ $en ? 'PAID' : 'PAYÉE' }}</div>
        </td>
    </tr>
</table>

<table class="row">
    <tr>
        <td>
            <div class="muted">{{ $en ? 'Billed to' : 'Facturé à' }}</div>
            <strong>{{ $customerName }}</strong><br>
            @if ($customerEmail) {{ $customerEmail }}<br> @endif
            @if ($order->phone) {{ $order->phone }}<br> @endif
            @if ($address) {{ $address }} @endif
        </td>
        <td class="r muted">
            {{ $en ? 'Order' : 'Commande' }} #{{ $order->id }}
        </td>
    </tr>
</table>

<table class="items">
    <thead>
        <tr>
            <th>{{ $en ? 'Item' : 'Article' }}</th>
            <th class="r">{{ $en ? 'Qty' : 'Qté' }}</th>
            <th class="r">{{ $en ? 'Unit price' : 'Prix unitaire' }}</th>
            <th class="r">Total</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($lines as $line)
            <tr>
                <td>{{ $line['name'] }}</td>
                <td class="r">{{ $line['quantity'] }}</td>
                <td class="r">{{ $money($line['unit_price']) }}</td>
                <td class="r">{{ $money($line['line_total']) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table class="totals">
    <tr><td>{{ $en ? 'Subtotal' : 'Sous-total' }}</td><td class="r">{{ $money($subtotal) }}</td></tr>
    @if ((int) $order->delivery_fee > 0)
        <tr><td>{{ $en ? 'Delivery' : 'Livraison' }}</td><td class="r">{{ $money($order->delivery_fee) }}</td></tr>
    @endif
    <tr class="grand"><td>Total</td><td class="r">{{ $money($order->total) }}</td></tr>
</table>

<p class="foot">{{ $en ? 'Thank you for your purchase.' : 'Merci pour votre achat.' }}</p>
</body>
</html>