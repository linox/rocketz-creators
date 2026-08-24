# Auth e RBAC

## Mecânica

- Laravel Sanctum (personal access token)
- Next.js guarda o token em `localStorage` (`rocktz_token`) e chama a API Laravel direto (export estático para cPanel, sem Node)
- CORS: `FRONTEND_URL` na API precisa ser a origem do site estático
- Google OAuth: `GOOGLE_REDIRECT_URI` em produção é `https://api.creatorz.digital/api/auth/google/callback`

## Endpoints Laravel (`/api/auth`)

- `POST /register/creator` — cria user + creator `review` + consentimento LGPD
- `POST /register/company` — cria user + company `pending` + company_user
- `POST /login`
- `POST /logout` (sanctum)
- `GET /me` (sanctum)
- `POST /forgot-password` / `POST /reset-password` — e-mail via Resend em produção (`MAIL_MAILER=resend`)
- `GET /google/redirect` e `GET /google/callback` (OAuth via HTTP client; Socialite não fecha com Guzzle 8 do Laravel 13)
- `POST /google/complete` (sanctum) — completa perfil se o Google user ainda não tem creator/company
- `PATCH /locale` (sanctum) — grava `users.locale` (`pt-BR` | `en` | `es`)

A API lê `Accept-Language` (`pt-BR`, `en` ou `es`) e responde mensagens/validação nesse idioma. O e-mail de reset usa `users.locale` (`HasLocalePreference`).

## Redirects no front

- admin → `/` ou `/dashboard`
- company → `/company-dashboard`
- creator → `/creator-dashboard`

Papel vive em `users.role`. Middleware Laravel `role:admin,creator,company`. Sem whitelist de e-mail.
