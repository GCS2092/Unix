<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Certificat — {{ $courseTitle }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; text-align: center; padding: 48px; }
        h1 { font-size: 28px; margin-bottom: 8px; }
        h2 { font-size: 20px; font-weight: normal; color: #444; }
        .name { font-size: 32px; margin: 32px 0; font-weight: bold; }
        .date { margin-top: 48px; color: #666; }
    </style>
</head>
<body>
    <h1>Certificat de réussite</h1>
    <h2>{{ $courseTitle }}</h2>
    <p>Décerné à</p>
    <div class="name">{{ $userName }}</div>
    <p class="date">Délivré le {{ $issuedAt->format('d/m/Y') }}</p>
</body>
</html>
