<!DOCTYPE html>
<html lang="{{ $locale ?? 'pt-BR' }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F9FAFB;padding:24px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
                <tr>
                    <td style="padding:28px 32px 12px 32px;">
                        <p style="margin:0;font-size:28px;font-weight:900;letter-spacing:-0.04em;line-height:1;">
                            <span style="color:#0B0C18;">creator</span><span style="color:#8A3FFC;">z</span>
                        </p>
                        <p style="margin:4px 0 0;font-size:12px;color:#6B7280;font-weight:500;">by rocketz</p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 32px 8px;">
                        <h1 style="margin:0;font-size:22px;line-height:1.3;color:#0F172A;">{{ $title }}</h1>
                    </td>
                </tr>
                @if(!empty($greeting))
                <tr>
                    <td style="padding:8px 32px 0;font-size:16px;color:#0F172A;">{{ $greeting }}</td>
                </tr>
                @endif
                <tr>
                    <td style="padding:12px 32px 8px;font-size:15px;line-height:1.6;color:#334155;">{!! $bodyHtml !!}</td>
                </tr>
                @if(!empty($highlights))
                <tr>
                    <td style="padding:8px 32px 8px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;">
                            @foreach($highlights as $row)
                            <tr>
                                <td style="padding:10px 16px;font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:.04em;width:40%;">{{ $row['label'] }}</td>
                                <td style="padding:10px 16px;font-size:14px;color:#0F172A;font-weight:600;">{{ $row['value'] }}</td>
                            </tr>
                            @endforeach
                        </table>
                    </td>
                </tr>
                @endif
                @if(!empty($ctaLabel) && !empty($ctaUrl))
                <tr>
                    <td style="padding:20px 32px 28px;" align="left">
                        <a href="{{ $ctaUrl }}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">{{ $ctaLabel }}</a>
                    </td>
                </tr>
                @endif
                <tr>
                    <td style="padding:20px 32px 28px;border-top:1px solid #E2E8F0;font-size:12px;line-height:1.6;color:#64748B;">
                        <p style="margin:0 0 8px;font-weight:700;color:#0F172A;">{{ $brand }}</p>
                        <p style="margin:0 0 8px;">{{ $footerNote }}</p>
                        <p style="margin:0;">
                            <a href="{{ $supportUrl }}" style="color:#6366f1;text-decoration:none;">{{ $supportLabel }}</a>
                            · {{ $supportAddress }}
                            · <a href="{{ $preferencesUrl }}" style="color:#6366f1;text-decoration:none;">{{ $preferencesLabel }}</a>
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
