# Auth e RBAC

## Mecânica

- Laravel Sanctum (personal access token)
- Next.js guarda o token em cookie **httpOnly** (`rocktz_token`) via route handlers em `/api/auth/*`
- O browser não lê o token; o BFF do Next chama a API Laravel

## Endpoints Laravel (`/api/auth`)

- `POST /register/creator` — cria user + creator `review` + consentimento LGPD
- `POST /register/company` — cria user + company `pending` + company_user
- `POST /login`
- `POST /logout` (sanctum)
- `GET /me` (sanctum)
- `POST /forgot-password` / `POST /reset-password`
- `GET /google/redirect` e `GET /google/callback` (OAuth via HTTP client; Socialite não fecha com Guzzle 8 do Laravel 13)
- `POST /google/complete` (sanctum) — completa perfil se o Google user ainda não tem creator/company

## Redirects no front

- admin → `/` ou `/dashboard`
- company → `/company-dashboard`
- creator → `/creators/{id}`

Papel vive em `users.role`. Middleware Laravel `role:admin,creator,company`. Sem whitelist de e-mail.
