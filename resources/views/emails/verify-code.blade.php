@php
    $logo = public_path('brand/logo-betcc-email.png');
    $logoSrc = (isset($message) && is_file($logo)) ? $message->embed($logo) : null;
    $digits = str_split((string) $code);
@endphp
<!DOCTYPE html>
<html lang="{{ $en ? 'en' : 'fr' }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $en ? 'Verify your email' : 'Vérifiez votre e-mail' }}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td align="center" style="background:#2b3150;padding:26px 20px;">
      @if($logoSrc)
        <img src="{{ $logoSrc }}" alt="BETCC" height="44" style="display:block;height:44px;border:0;">
      @else
        <span style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:2px;">BETCC</span>
      @endif
    </td></tr>
    <tr><td style="padding:32px 28px 8px;text-align:center;">
      <h1 style="margin:0 0 10px;font-size:22px;color:#2b3150;">{{ $en ? 'Confirm your email address' : 'Confirmez votre adresse e-mail' }}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">
        {{ $en ? 'Hello' : 'Bonjour' }}@if($name) <strong>{{ $name }}</strong>@endif,<br>
        {{ $en ? 'enter this code to finish creating your account:' : 'saisissez ce code pour terminer la création de votre compte :' }}
      </p>
    </td></tr>
    <tr><td align="center" style="padding:22px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        @foreach($digits as $d)
          <td style="padding:0 3px;"><div style="width:42px;height:54px;line-height:54px;text-align:center;font-size:28px;font-weight:bold;color:#2b3150;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;">{{ $d }}</div></td>
        @endforeach
      </tr></table>
      <p style="margin:14px 0 0;font-size:13px;color:#64748b;">
        {{ $en ? 'Valid for '.$minutes.' minutes.' : 'Valable '.$minutes.' minutes.' }}
      </p>
    </td></tr>
    <tr><td align="center" style="padding:0 28px 28px;">
      <p style="margin:0 0 14px;font-size:14px;color:#475569;">{{ $en ? 'Or confirm in one click:' : 'Ou confirmez en un clic :' }}</p>
      <a href="{{ $url }}" style="display:inline-block;background:#f28c28;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 30px;border-radius:10px;">
        {{ $en ? 'Confirm my address' : 'Confirmer mon adresse' }}
      </a>
    </td></tr>
    <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#64748b;">
        {{ $en ? 'Never share this code with anyone. BETCC will never ask for it.' : 'Ne communiquez jamais ce code. BETCC ne vous le demandera jamais.' }}
      </p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">
        {{ $en ? 'If you did not create an account, you can ignore this email.' : "Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet e-mail." }}
      </p>
    </td></tr>
  </table>
  <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;">© BETCC</p>
</td></tr>
</table>
</body>
</html>