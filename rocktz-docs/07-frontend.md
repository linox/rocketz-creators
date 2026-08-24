# Frontend (rocktz-web)

Next.js App Router, React 19, Tailwind v4, Inter, tokens do legado (`#6366F1`, sidebar `#111827`, landing `#FDFDFE`, login `#0F172A`).

## Rotas

- `/` e `/join` — landing (modal de login com “Esqueci minha senha”; admin autenticado em `/` vê o dashboard)
- `/l/[slug]` — landing pública da empresa
- `/login` — login/signup criador ou empresa, Google, esqueci senha
- `/reset-password` — link enviado por e-mail
- `/dashboard` — KPIs da agência
- `/company-dashboard` — painel da empresa (campanhas, recorrentes, favoritos)
- `/creator-dashboard` — início/central do criador
- `/creators` — lista do casting (admin aprova/rejeita e cadastra)
- `/creators/[id]` — perfil, mídia kit, portfólio por URL, termo de adesão
- `/companies` — marcas (admin aprova/rejeita e cadastra)
- `/campaigns` — lista; `/campaigns/[id]` — briefing, candidaturas, entregas (URL)
- `/available-campaigns` — vitrine + candidatura do criador
- `/campaign-deliveries` — atalho de entregas (campanhas e recorrentes)
- `/recurring` — contratos; `/recurring/[id]` — criadores, pautas por mês, envio de URL
- `/notifications` — inbox
- `/admin-users` — usuários `role=admin`

Menus no `AppShell` seguem o legado (admin inclui Usuários Admin; criador tem Meu perfil).

## Formulários

Dropdown = `Select2Field` (nunca `<select>` nativo). Alertas = SweetAlert (`alertWarning`, `alertError`, `alertSuccess`, `alertApiError`, `alertConfirm`). Forms com `noValidate`.

## Idioma

`i18next` no cliente (sem prefixo na URL). Seletor `PT` / `EN` / `ES` na landing, no login e na sidebar. JSON em `src/i18n/locales/{pt-BR,en,es}/`. Toda chamada Laravel leva `Accept-Language`. Usuário logado sincroniza via `PATCH /auth/locale`.

Strings de UI novas entram só via `t('chave')` — nunca hardcoded.

## Sessão e dados

Export estático (`output: "export"`, `trailingSlash`). Sem Node no cPanel.

Rotas dinâmicas usam `generateStaticParams` com `{ id: "_" }` ou `{ slug: "_" }`. O Apache em [`scripts/cpanel.htaccess`](../scripts/cpanel.htaccess) reescreve `/creators/{id}`, `/campaigns/{id}`, `/recurring/{id}` e `/l/{slug}` para o HTML `_`.

O browser chama a API Laravel em `NEXT_PUBLIC_API_URL` e guarda o token Sanctum em `localStorage` (`rocktz_token`). Helpers em `src/lib/api.ts` (`api.creators()`, `api.campaign()` etc.).

- Local: `http://localhost:8000/api`
- Produção: `https://apicreators.rocketz.me/api`

Callback do Google: `/auth/callback?token=`

Contas seed (senha `password`): `admin@rocketz.test`, `ana.creator@rocketz.test`, `bruno.creator@rocketz.test` (em análise), `empresa@rocketz.test`.

## Marca

Componente `RocketzLogo`: wordmark rocket + **z** roxo + CREATORS.
