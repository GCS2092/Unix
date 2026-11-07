{{-- qr-center --}}
@php
    $c = $tpl['color'] ?? '#1f64c0';
    $g = $tpl['accent'] ?? '#3fa535';
    $brand = $tpl['brand'] ?? 'International Geospatial Academy';

    // Dimensions d'une image dans une boite maximale (mm), sans la deformer
    $fit = function (?string $uri, float $maxW, float $maxH): array {
        if (! $uri || ! str_contains($uri, ',')) {
            return [$maxW, $maxH];
        }
        $info = @getimagesizefromstring((string) base64_decode(substr($uri, strpos($uri, ',') + 1)));
        if (! $info || $info[0] < 1 || $info[1] < 1) {
            return [$maxW, $maxH];
        }
        $k = min($maxW / $info[0], $maxH / $info[1]);

        return [round($info[0] * $k, 2), round($info[1] * $k, 2)];
    };

    // La taille du nom et du titre s'adapte a leur longueur : le certificat reste sur une seule page
    $nameLen = mb_strlen((string) $userName);
    $nameSize = $nameLen <= 28 ? 34 : ($nameLen <= 38 ? 28 : ($nameLen <= 50 ? 23 : 19));
    $courseLen = mb_strlen((string) $courseTitle);
    $courseSize = $courseLen <= 45 ? 21 : ($courseLen <= 70 ? 17 : ($courseLen <= 100 ? 14 : 12));

    [$logoW, $logoH] = $fit($tpl['logo'] ?? null, 80, 19);
    [$stampW, $stampH] = $fit($tpl['stamp'] ?? null, 24, 24);

    $s1 = ['img' => $tpl['signature'] ?? null, 'name' => $tpl['signer_name'] ?? '', 'title' => $tpl['signer_title'] ?? ''];
    $s2 = ['img' => $tpl['signature2'] ?? null, 'name' => $tpl['signer2_name'] ?? '', 'title' => $tpl['signer2_title'] ?? ''];
    $two = ! empty($s2['name']) || ! empty($s2['img']);
    // Un signataire : date | QR code | signature. Deux : signature | QR code | signature (date dans le pied).
    $left = $two ? $s1 : null;
    $right = $two ? $s2 : $s1;
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Certificat - {{ $courseTitle }}</title>
    <style>
        @page { size: A4 landscape; margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        body { font-family: DejaVu Sans, sans-serif; color: #1f2937; background: #ffffff; }
        .frame { position: absolute; top: 7mm; left: 7mm; right: 7mm; bottom: 7mm; border: 3px solid {{ $c }}; }
        .inner { position: absolute; top: 11mm; left: 11mm; right: 11mm; bottom: 11mm; border: 1px solid {{ $g }}; }
        .corner { position: absolute; width: 5mm; height: 5mm; background: {{ $g }}; }
        .c1 { top: 9mm; left: 9mm; } .c2 { top: 9mm; right: 9mm; }
        .c3 { bottom: 9mm; left: 9mm; } .c4 { bottom: 9mm; right: 9mm; }
        .content { position: absolute; top: 14mm; left: 24mm; right: 24mm; text-align: center; }
        .brand { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: {{ $c }}; font-weight: bold; margin-top: 1mm; }
        .title { font-family: DejaVu Serif, serif; font-size: 36px; letter-spacing: 8px; color: {{ $c }}; margin: 5mm 0 0; }
        .subtitle { font-size: 11px; letter-spacing: 6px; text-transform: uppercase; color: {{ $g }}; margin: 1mm 0 0; font-weight: bold; }
        .rule { width: 40mm; height: 0; border-top: 2px solid {{ $g }}; margin: 3mm auto 0; }
        .lead { font-size: 12px; color: #6b7280; margin: 6mm 0 0; font-style: italic; }
        .name { font-family: DejaVu Serif, serif; font-weight: bold; color: #111827; margin: 3mm auto 0; padding-bottom: 2mm; border-bottom: 1px solid {{ $g }}; display: inline-block; min-width: 120mm; }
        .birth { font-size: 11px; color: #6b7280; margin: 3mm 0 0; }
        .text { font-size: 12px; color: #6b7280; margin: 5mm 0 0; }
        .course { font-weight: bold; color: {{ $c }}; margin: 2mm 0 0; }
        .row { position: absolute; top: 139mm; left: 30mm; width: 237mm; }
        .row td { vertical-align: bottom; text-align: center; height: 37mm; }
        .lbl { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #9ca3af; }
        .val { font-size: 13px; font-weight: bold; color: #111827; margin-top: 1mm; }
        .sig-line { border-top: 1px solid #9ca3af; margin: 1mm 8mm 0; padding-top: 1.5mm; }
        .code { font-size: 11px; font-weight: bold; color: #111827; letter-spacing: 1px; margin-top: 0.5mm; }
        .footer { position: absolute; top: 183mm; left: 38mm; right: 38mm; text-align: center; font-size: 9px; color: #6b7280; }
        .small { font-size: 8px; color: #9ca3af; }
    </style>
</head>
<body>
    <div class="frame"></div>
    <div class="inner"></div>
    <div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>

    <div class="content">
        @if (! empty($tpl['logo']))
            <img src="{{ $tpl['logo'] }}" alt="" style="width: {{ $logoW }}mm; height: {{ $logoH }}mm;"><br>
        @endif
        <div class="brand">{{ $brand }}</div>
        <div class="title">CERTIFICAT</div>
        <div class="subtitle">de réussite</div>
        <div class="rule"></div>
        <div class="lead">Ce certificat est décerné à</div>
        <div class="name" style="font-size: {{ $nameSize }}px;">{{ $userName }}</div>
        @if (! empty($birthDate) || ! empty($birthPlace))
            <div class="birth">
                Né(e)
                @if (! empty($birthDate)) le {{ $birthDate }} @endif
                @if (! empty($birthPlace)) à {{ $birthPlace }} @endif
            </div>
        @endif
        <div class="text">pour avoir suivi avec succès la formation</div>
        <div class="course" style="font-size: {{ $courseSize }}px;">{{ $courseTitle }}</div>
    </div>

    <table class="row">
        <tr>
            <td style="width: 33%;">
                @if ($left !== null)
                    @include('certificates.partials.signer', ['s' => $left, 'fit' => $fit])
                @else
                    <div style="height: 14mm;"></div>
                    <div class="sig-line">
                        <div class="val" style="margin-top:0">{{ $issuedAt->format('d/m/Y') }}</div>
                        <div class="lbl">Délivré le</div>
                    </div>
                @endif
            </td>
            <td style="width: 34%;">
                @if (! empty($qr))
                    <img src="{{ $qr }}" alt="" style="width: 24mm; height: 24mm;">
                @endif
                <div class="lbl" style="margin-top: 1.5mm;">Code de vérification</div>
                <div class="code">{{ $code }}</div>
            </td>
            <td style="width: 33%;">
                @include('certificates.partials.signer', ['s' => $right, 'fit' => $fit])
            </td>
        </tr>
    </table>

    @if (! empty($tpl['stamp']))
        <img src="{{ $tpl['stamp'] }}" alt="" style="position: absolute; top: {{ 168 - $stampH }}mm; left: 172mm; width: {{ $stampW }}mm; height: {{ $stampH }}mm;">
    @endif

    <div class="footer">
        @if ($two)Délivré le {{ $issuedAt->format('d/m/Y') }}<br>@endif
        <span class="small">Vérifiez l'authenticité de ce certificat sur {{ $verifyUrl }}</span>
    </div>
</body>
</html>