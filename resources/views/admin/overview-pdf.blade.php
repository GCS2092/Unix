@php
    $f = fn ($n) => number_format((int) $n, 0, ',', ' ');
    $pct = fn ($a, $b) => $b > 0 ? number_format($a / $b * 100, 1, ',', ' ') : '0';
    $periods = ['7d' => '7 derniers jours', '30d' => '30 derniers jours', '90d' => '90 derniers jours', '12m' => '12 derniers mois', 'all' => 'Toute la période'];

    $fc = function (array $c, array $defs): array {
        $rows = [];
        $known = 0;
        foreach ($defs as $k => [$label, $color]) {
            $v = (int) ($c[$k] ?? 0);
            $rows[] = ['label' => $label, 'value' => $v, 'color' => $color];
            $known += $v;
        }
        $other = array_sum($c) - $known;
        if ($other > 0) {
            $rows[] = ['label' => 'Autres', 'value' => $other, 'color' => '#e2e8f0'];
        }

        return $rows;
    };

    $var = function ($cur, $prev) {
        if ($prev === null) return null;
        if ($prev == 0) return $cur == 0 ? 0 : null;

        return round(($cur - $prev) / $prev * 100, 1);
    };
    $fmtVar = fn ($v) => $v === null ? '' : ($v > 0 ? '▲ +' : ($v < 0 ? '▼ −' : '= ')).number_format(abs($v), 1, ',', '').' %';
    $varColor = fn ($v) => $v === null ? '#64748b' : ($v > 0 ? '#059669' : ($v < 0 ? '#dc2626' : '#64748b'));

    $o = $d['orders'];
    $paid = (int) ($o['status']['paid'] ?? 0);
    $basket = $paid > 0 ? $d['revenue']['total'] / $paid : null;
    $prev = $d['previous'];
    $prevBasket = $prev && $prev['paid'] > 0 ? $prev['revenue'] / $prev['paid'] : null;
    $s = $d['stock'];

    $kpis = [
        ['Commandes', $f($o['total']), $var($o['total'], $prev['orders'] ?? null)],
        ["Chiffre d'affaires encaissé", $f($d['revenue']['total']).' FCFA', $var($d['revenue']['total'], $prev['revenue'] ?? null)],
        ['Taux de paiement', $pct($paid, $o['total']).' %', null],
        ['Panier moyen', $basket !== null ? $f(round($basket)).' FCFA' : '—', $basket !== null ? $var($basket, $prevBasket) : null],
    ];

    $products = [];
    $palette = ['#0f766e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
    foreach (collect($d['revenue']['by_product'])->values() as $i => $p) {
        $products[] = ['label' => $p['name'], 'value' => (int) $p['revenue'], 'color' => $palette[$i % 5]];
    }
    if ($d['revenue']['others'] > 0) {
        $products[] = ['label' => 'Autres produits', 'value' => (int) $d['revenue']['others'], 'color' => '#94a3b8'];
    }

    $sections = [
        ['title' => 'Statut des commandes', 'rows' => $fc($o['status'], [
            'paid' => ['Payées', '#10b981'], 'pending' => ['En attente', '#f59e0b'], 'failed' => ['Échouées', '#ef4444'], 'cancelled' => ['Annulées', '#94a3b8'],
        ])],
        ['title' => 'Mode de livraison', 'rows' => $fc($o['delivery_method'], [
            'delivery' => ['Livraison à domicile', '#3b82f6'], 'pickup' => ['Retrait sur place', '#8b5cf6'], 'none' => ['Numérique / autre', '#94a3b8'],
        ])],
        ['title' => 'Zone de livraison', 'note' => 'Commandes en livraison à domicile', 'rows' => $fc($o['delivery_zone'], [
            'dakar' => ['Dakar', '#0f766e'], 'regions' => ['Régions', '#f59e0b'], 'none' => ['Autre', '#94a3b8'],
        ])],
        ['title' => 'Avancement des commandes payées', 'rows' => $fc($o['fulfillment'], [
            'received' => ['Reçues', '#94a3b8'], 'preparing' => ['En préparation', '#f59e0b'], 'shipped' => ['Expédiées', '#3b82f6'],
            'ready' => ['Prêtes à retirer', '#8b5cf6'], 'delivered' => ['Livrées', '#10b981'], 'picked_up' => ['Retirées', '#0f766e'], 'none' => ['Sans suivi', '#cbd5e1'],
        ])],
        ['title' => 'Conflits de stock', 'note' => 'Commandes payées sans stock disponible au paiement', 'rows' => [
            ['label' => 'Avec conflit', 'value' => (int) $o['paid_with_conflict'], 'color' => '#ef4444'],
            ['label' => 'Sans conflit', 'value' => max(0, $paid - (int) $o['paid_with_conflict']), 'color' => '#10b981'],
        ]],
        ['title' => 'Comptes et invités (origine des commandes)', 'rows' => [
            ['label' => 'Clients avec compte', 'value' => (int) $o['accounts'], 'color' => '#0f766e'],
            ['label' => 'Invités', 'value' => (int) $o['guests'], 'color' => '#f59e0b'],
        ]],
        ['title' => "Chiffre d'affaires par produit", 'note' => 'Top 5 des produits sur les commandes payées', 'unit' => ' FCFA', 'rows' => $products],
        ['title' => 'Santé du stock (état actuel)', 'note' => 'Stock bas : '.$s['threshold'].' unités ou moins', 'rows' => [
            ['label' => 'En stock', 'value' => $s['ok'], 'color' => '#10b981'],
            ['label' => 'Stock bas', 'value' => $s['low'], 'color' => '#f59e0b'],
            ['label' => 'Épuisés', 'value' => $s['out'], 'color' => '#ef4444'],
        ]],
        ['title' => 'Publication des produits', 'rows' => [
            ['label' => 'Visibles', 'value' => $s['published'], 'color' => '#3b82f6'],
            ['label' => 'Masqués', 'value' => $s['hidden'], 'color' => '#94a3b8'],
        ]],
        ['title' => 'Unités en stock', 'note' => 'Réservées = commandes en attente de paiement', 'rows' => [
            ['label' => 'Disponibles', 'value' => $s['units_available'], 'color' => '#0f766e'],
            ['label' => 'Réservées', 'value' => $s['units_reserved'], 'color' => '#f59e0b'],
        ]],
        ['title' => 'Factures', 'rows' => [
            ['label' => 'Émises', 'value' => $d['invoices']['issued'], 'color' => '#10b981'],
            ['label' => 'Annulées', 'value' => $d['invoices']['cancelled'], 'color' => '#ef4444'],
        ]],
        ['title' => 'Comptes utilisateurs (état actuel)', 'rows' => [
            ['label' => 'Actifs', 'value' => max(0, $d['users']['total'] - $d['users']['blocked']), 'color' => '#3b82f6'],
            ['label' => 'Bloqués', 'value' => $d['users']['blocked'], 'color' => '#ef4444'],
        ]],
    ];
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Aperçu de la boutique</title>
<style>
    @page { margin: 16mm 14mm }
    body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #0f172a }
    h1 { font-size: 18px; margin: 0 0 3px }
    h2 { font-size: 12px; margin: 0 0 4px; padding-bottom: 3px; border-bottom: 1px solid #e2e8f0 }
    .muted { color: #64748b }
    table { width: 100%; border-collapse: collapse }
    td { padding: 3px 5px; vertical-align: middle }
    .kpi td { border: 1px solid #e2e8f0; width: 25%; padding: 8px }
    .kpi .v { font-size: 14px; font-weight: bold; margin-top: 3px }
    .num { text-align: right; white-space: nowrap }
    .bar { height: 7px }
    .sec { margin-top: 14px; page-break-inside: avoid }
</style>
</head>
<body>
    <h1>Aperçu de la boutique</h1>
    <p class="muted" style="margin: 0 0 12px">
        Période : {{ $periods[$d['range']] ?? $d['range'] }} · Édité le {{ $generatedAt->format('d/m/Y à H:i') }}
    </p>

    <table class="kpi">
        <tr>
            @foreach ($kpis as [$label, $value, $delta])
                <td>
                    <div class="muted">{{ $label }}</div>
                    <div class="v">{{ $value }}</div>
                    <div style="color: {{ $varColor($delta) }}">{{ $fmtVar($delta) }}&nbsp;</div>
                </td>
            @endforeach
        </tr>
    </table>
    @if ($prev)
        <p class="muted" style="margin: 4px 0 0">Variations calculées par rapport à la période précédente de même durée.</p>
    @endif

    @foreach ($sections as $sec)
        @php $total = collect($sec['rows'])->sum('value'); @endphp
        <div class="sec">
            <h2>{{ $sec['title'] }}</h2>
            @if (! empty($sec['note']))
                <p class="muted" style="margin: 0 0 3px">{{ $sec['note'] }}</p>
            @endif
            <table>
                @foreach ($sec['rows'] as $r)
                    <tr>
                        <td style="width: 34%">{{ $r['label'] }}</td>
                        <td style="width: 38%">
                            <div class="bar" style="background: {{ $r['color'] }}; width: {{ $r['value'] > 0 && $total > 0 ? max(1, round($r['value'] / $total * 100)) : 0 }}%"></div>
                        </td>
                        <td class="num"><strong>{{ $f($r['value']) }}</strong>{{ $sec['unit'] ?? '' }}</td>
                        <td class="num muted">{{ $pct($r['value'], $total) }} %</td>
                    </tr>
                @endforeach
            </table>
        </div>
    @endforeach
</body>
</html>