<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Certificat - {{ $courseTitle }}</title>
    <style>
        @page { size: A4 landscape; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; font-family: DejaVu Sans, sans-serif; color: #1f2937; }
        .frame { position: absolute; top: 8mm; left: 8mm; right: 8mm; bottom: 8mm; border: 3px solid #0b4a6f; }
        .inner { position: absolute; top: 12mm; left: 12mm; right: 12mm; bottom: 12mm; border: 1px solid #c9a227; }
        .content { position: absolute; top: 24mm; left: 24mm; right: 24mm; text-align: center; }
        .brand { font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #0b4a6f; font-weight: bold; }
        .rule { width: 60mm; height: 2px; background: #c9a227; margin: 4mm auto 0; }
        .title { font-family: DejaVu Serif, serif; font-size: 34px; color: #0b4a6f; margin: 8mm 0 0; }
        .lead { font-size: 13px; color: #6b7280; margin: 8mm 0 0; }
        .name { font-family: DejaVu Serif, serif; font-size: 36px; font-weight: bold; color: #111827; margin: 4mm 0 0; }
        .birth { font-size: 12px; color: #6b7280; margin: 2mm 0 0; }
        .text { font-size: 13px; color: #6b7280; margin: 8mm 0 0; }
        .course { font-size: 22px; font-weight: bold; color: #0b4a6f; margin: 3mm 0 0; }
        .footer { position: absolute; bottom: 20mm; left: 24mm; right: 24mm; text-align: center; font-size: 11px; color: #6b7280; }
        .footer strong { color: #111827; letter-spacing: 1px; }
        .small { font-size: 9px; color: #9ca3af; margin-top: 2mm; }
    </style>
</head>
<body>
    <div class="frame"></div>
    <div class="inner"></div>

    <div class="content">
        <div class="brand">{{ config('app.name') }}</div>
        <div class="rule"></div>
        <div class="title">Certificat de réussite</div>
        <div class="lead">Ce certificat est décerné à</div>
        <div class="name">{{ $userName }}</div>
        @if (! empty($birthDate) || ! empty($birthPlace))
            <div class="birth">
                Né(e)
                @if (! empty($birthDate)) le {{ $birthDate }} @endif
                @if (! empty($birthPlace)) à {{ $birthPlace }} @endif
            </div>
        @endif
        <div class="text">pour avoir suivi avec succès la formation</div>
        <div class="course">{{ $courseTitle }}</div>
    </div>

    <div class="footer">
        Délivré le <strong>{{ $issuedAt->format('d/m/Y') }}</strong>
        &nbsp;&middot;&nbsp; Code de vérification : <strong>{{ $code }}</strong>
        <div class="small">Vérifiez l'authenticité de ce certificat sur {{ $verifyUrl }}</div>
    </div>
</body>
</html>