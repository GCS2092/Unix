<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Retour paiement — {{ config('app.name') }}</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; color: #1f2937; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; }
        h1 { font-size: 1.5rem; margin-top: 0; }
        .muted { color: #6b7280; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Retour de paiement</h1>

        @if ($order)
            <p>Commande <strong>#{{ $order->id }}</strong></p>
            <p class="muted">Montant : {{ $order->total }} {{ $order->currency }}</p>
            <p>Statut actuel : <strong>{{ $order->status->label() }}</strong></p>
        @else
            <p class="muted">Aucune commande trouvée pour cette transaction.</p>
        @endif

        @if ($transactionId)
            <p class="muted">Transaction : {{ $transactionId }}</p>
        @endif

        @if ($status)
            <p>Réponse CinetPay : <strong>{{ $status }}</strong></p>
        @endif

        <p class="muted">La confirmation définitive est envoyée par webhook serveur. Cette page est informative.</p>
    </div>
</body>
</html>
