# Frontend (rocktz-web)

Next.js App Router, React 19, Tailwind v4, Inter, tokens do legado (`#6366F1`, sidebar `#111827`, landing `#FDFDFE`, login `#0F172A`).

## Rotas

- `/` e `/join` — landing (admin autenticado em `/` vê o placeholder do dashboard)
- `/login` — login/signup criador ou empresa, Google, esqueci senha
- `/reset-password` — link enviado por e-mail
- `/dashboard` — placeholder admin
- `/company-dashboard` — placeholder empresa
- `/creators/[id]` — placeholder do portal do criador
- Demais itens do menu (campanhas, entregas, etc.) — placeholders “em construção”

## Sessão

Route handlers em `src/app/api/auth/*` falam com o Laravel e gravam `rocktz_token` httpOnly.

- `POST /api/auth/session` — login
- `GET /api/auth/session` — me
- `DELETE /api/auth/session` — logout
- `POST /api/auth/register/creator|company`
- `GET /api/auth/callback?token=` — callback do Google

## Marca

Componente `RocketzLogo`: wordmark rocket + **z** roxo + CREATORS.
