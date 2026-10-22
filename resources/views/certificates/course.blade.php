@php
    $c = $tpl['color'] ?? '#0b4a6f';
    $gold = '#c9a227';
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
        body { font-family: DejaVu Sans, sans-serif; color: #1f2937; background: #fffdf7; }
        .frame { position: absolute; top: 7mm; left: 7mm; right: 7mm; bottom: 7mm; border: 3px solid {{ $c }}; }
        .inner { position: absolute; top: 11mm; left: 11mm; right: 11mm; bottom: 11mm; border: 1px solid {{ $gold }}; }
        .corner { position: absolute; width: 5mm; height: 5mm; background: {{ $gold }}; }
        .c1 { top: 9mm; left: 9mm; } .c2 { top: 9mm; right: 9mm; }
        .c3 { bottom: 9mm; left: 9mm; } .c4 { bottom: 9mm; right: 9mm; }
        .content { position: absolute; top: 17mm; left: 24mm; right: 24mm; text-align: center; }
        .logo { height: 17mm; margin-bottom: 1mm; }
        .brand { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: {{ $c }}; font-weight: bold; }
        .title { font-family: DejaVu Serif, serif; font-size: 38px; letter-spacing: 8px; color: {{ $c }}; margin: 6mm 0 0; }
        .subtitle { font-size: 11px; letter-spacing: 6px; text-transform: uppercase; color: {{ $gold }}; margin: 1mm 0 0; font-weight: bold; }
        .lead { font-size: 12px; color: #6b7280; margin: 7mm 0 0; font-style: italic; }
        .name { font-family: DejaVu Serif, serif; font-size: 34px; font-weight: bold; color: #111827; margin: 3mm auto 0; padding-bottom: 2mm; border-bottom: 1px solid {{ $gold }}; display: inline-block; min-width: 120mm; }
        .birth { font-size: 11px; color: #6b7280; margin: 3mm 0 0; }
        .text { font-size: 12px; color: #6b7280; margin: 6mm 0 0; }
        .course { font-size: 21px; font-weight: bold; color: {{ $c }}; margin: 2mm 0 0; }
        .row { position: absolute; left: 30mm; right: 30mm; bottom: 31mm; width: 237mm; }
        .row td { vertical-align: bottom; text-align: center; }
        .lbl { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #9ca3af; }
        .val { font-size: 13px; font-weight: bold; color: #111827; margin-top: 1mm; }
        .seal { width: 25mm; height: 25mm; margin: 0 auto; border: 2px solid {{ $gold }}; border-radius: 50%; background: #fffaf0; }
        .seal-in { margin: 1.6mm; width: 18.8mm; height: 18.8mm; border: 1px solid {{ $c }}; border-radius: 50%; text-align: center; padding-top: 5.5mm; font-size: 7px; font-weight: bold; letter-spacing: 1px; color: {{ $c }}; line-height: 1.5; }
        .sig-img { height: 14mm; }
        .sig-space { height: 14mm; }
        .sig-line { border-top: 1px solid #9ca3af; margin: 1mm 8mm 0; padding-top: 1.5mm; }
        .footer { position: absolute; bottom: 16mm; left: 24mm; right: 24mm; text-align: center; font-size: 9px; color: #6b7280; }
        .footer strong { color: #111827; letter-spacing: 1px; }
        .small { font-size: 8px; color: #9ca3af; margin-top: 1mm; }
    </style>
</head>
<body>
    <div class="frame"></div>
    <div class="inner"></div>
    <div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>

    <div class="content">
        @if (! empty($tpl['logo']))
            <img class="logo" src="{{ $tpl['logo'] }}" alt=""><br>
        @endif
        <div class="brand">{{ $tpl['brand'] ?? config('app.name') }}</div>
        <div class="title">CERTIFICAT</div>
        <div class="subtitle">de réussite</div>
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

    <table class="row">
        <tr>
            <td style="width: 33%;">
                <div class="lbl">Délivré le</div>
                <div class="val">{{ $issuedAt->format('d/m/Y') }}</div>
            </td>
            <td style="width: 34%;">
                <div class="seal"><div class="seal-in">CERTIFIÉ<br>&#9733;<br>AUTHENTIQUE</div></div>
            </td>
            <td style="width: 33%;">
                @if (! empty($tpl['signature']))
                    <img class="sig-img" src="{{ $tpl['signature'] }}" alt="">
                @else
                    <div class="sig-space"></div>
                @endif
                <div class="sig-line">
                    @if (! empty($tpl['signer_name']))<div class="val" style="margin-top:0">{{ $tpl['signer_name'] }}</div>@endif
                    <div class="lbl">{{ ! empty($tpl['signer_title']) ? $tpl['signer_title'] : 'Signature' }}</div>
                </div>
            </td>
        </tr>
    </table>

    @if (! empty($qr))
        <img src="{{ $qr }}" alt="" style="position:absolute; bottom:13mm; left:16mm; width:15mm; height:15mm;">
    @endif
    <div class="footer">
        Code de vérification : <strong>{{ $code }}</strong>
        <div class="small">Vérifiez l'authenticité de ce certificat sur {{ $verifyUrl }}</div>
    </div>
</body>
</html>