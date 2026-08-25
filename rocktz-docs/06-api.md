# API

Base local: `http://localhost:8000/api`  
Base produção: `https://api.creatorz.digital/api`  
Auth: `Authorization: Bearer {token}` (o front estático envia o token do `localStorage`). Em Apache/cPanel o header `Authorization` às vezes é removido; o front também manda `X-Auth-Token`.

Idioma: o front envia `Accept-Language: pt-BR|en|es` em toda chamada. A API só aceita esses três valores (`pt-BR` vira `pt_BR` no Laravel). Default `pt_BR`.

Papel via `users.role` + middleware `role:admin,creator,company`. Depois do login, o middleware `actor` carrega `creator` ou `companyUser.company`. Empresa só vê o que é dela; criador só o próprio perfil/participações; campanha `is_secret` só admin (ou criador já alocado).

Listas autenticadas respondem `{ "data": [ ... ] }`. O dashboard admin devolve KPIs na raiz (sem envelope `data`).

## Auth (público + sessão)

| Método | Caminho | Auth |
|---|---|---|
| GET | `/health` | público |
| POST | `/auth/register/creator` | público |
| POST | `/auth/register/company` | público |
| POST | `/auth/login` | público. Se 2FA estiver ativo, devolve `two_factor_required` + `challenge_token` (sem token Sanctum) |
| POST | `/auth/two-factor/verify` | público (`challenge_token` + código de 6 dígitos) |
| POST | `/auth/two-factor/resend` | público |
| POST | `/auth/forgot-password` | público (Resend em produção; não revela se o e-mail existe) |
| POST | `/auth/reset-password` | público |
| GET | `/auth/google/redirect` | público |
| GET | `/auth/google/callback` | público (se 2FA ativo, redireciona para `/login#two_factor=1&challenge=`) |
| POST | `/auth/logout` | sanctum |
| GET | `/auth/me` | sanctum (`two_factor_enabled`, `has_password`) |
| POST | `/auth/two-factor/enable` | sanctum (envia código) |
| POST | `/auth/two-factor/confirm` | sanctum |
| POST | `/auth/two-factor/disable-challenge` | sanctum |
| POST | `/auth/two-factor/disable` | sanctum (senha ou código) |
| POST | `/auth/google/complete` | sanctum |
| PATCH | `/auth/locale` | sanctum (`{ "locale": "pt-BR" \| "en" \| "es" }`) |

Resposta de login/register:

```json
{
  "token": "...",
  "user": {
    "id": 1,
    "name": "...",
    "email": "...",
    "role": "creator",
    "locale": "pt-BR",
    "creator": { "id": 1, "artistic_name": "...", "status": "review" },
    "company": null
  }
}
```

Cadastro de criador/empresa e Google complete aceitam `locale` opcional (`pt-BR`, `en`, `es`). Sem o campo, a API usa `Accept-Language` (ou `pt-BR`).

Quando `users.two_factor_enabled` é verdadeiro, o login não devolve `token`. O código sai na hora (fora da fila). O front pede o código do e-mail e chama `POST /auth/two-factor/verify`. A 2FA é opt-in em `/settings/security`.

## Dashboard

| Método | Caminho | Quem |
|---|---|---|
| GET | `/dashboard` | autenticado (KPIs por papel) |

Admin: `total_creators`, `active_creators`, `pending_approval_creators`, `running_campaigns`, `total_campaign_value`, `signatures`, `deliveries`.  
Empresa: `campaigns`, `running_campaigns`, `total_campaign_value`, `pending_applications`.  
Criador: `campaigns`, `approved_campaigns`, `pending_applications`, `status`.

## Criadores

| Método | Caminho | Quem |
|---|---|---|
| GET | `/creators` | autenticado (criador só vê o próprio; empresa só `active`) |
| POST | `/creators` | admin |
| GET | `/creators/{id}` | autenticado (escopo por papel) |
| PATCH | `/creators/{id}` | admin ou o próprio criador |
| POST | `/creators/{id}/approve` | admin |
| POST | `/creators/{id}/reject` | admin |
| POST | `/creators/{id}/portfolio` | admin ou o próprio (`title`, `url`, `description`) |
| DELETE | `/creators/{id}/portfolio/{video}` | admin ou o próprio |
| POST | `/creators/{id}/contract` | admin ou o próprio (aceite do termo) |

Filtros de lista: `?status=`, `?q=`, `?category=`. Portfólio nesta leva é **URL** (Drive, YouTube, Instagram, arquivo hospedado) — upload multipart fica para a sequência.

## Empresas

| Método | Caminho | Quem |
|---|---|---|
| GET | `/companies` | autenticado (empresa só a própria) |
| POST | `/companies` | admin |
| GET | `/companies/{id}` | autenticado (escopo) |
| PATCH | `/companies/{id}` | admin ou a própria empresa |
| POST | `/companies/{id}/approve` | admin |
| POST | `/companies/{id}/reject` | admin |
| DELETE | `/companies/{id}` | admin |
| POST | `/companies/{id}/favorites/{creator}` | admin ou a própria (toggle) |
| POST | `/companies/{id}/users` | admin |

## Campanhas, candidaturas e entregas

| Método | Caminho | Quem |
|---|---|---|
| GET | `/campaigns` | autenticado (escopo) |
| GET | `/campaigns/available` | autenticado (abertas; `is_secret` oculto para não-admin) |
| POST | `/campaigns` | admin ou empresa |
| GET | `/campaigns/{id}` | autenticado (escopo) |
| PATCH | `/campaigns/{id}` | admin ou empresa dona |
| DELETE | `/campaigns/{id}` | admin |
| POST | `/campaigns/{id}/apply` | criador `active` |
| POST | `/campaigns/{id}/assign` | admin |
| PATCH | `/campaign-creators/{id}` | autenticado (aprovar candidatura, roteiro, `video_url`, `published_link`) |

`GET /campaigns/available` precisa vir **antes** de `/{campaign}` nas rotas. Entrega de mídia: colar URL no PATCH da participação (`script`, `video_url`, `published_link`).

## Recorrência

| Método | Caminho | Quem |
|---|---|---|
| GET | `/recurring-contracts` | autenticado (escopo) |
| POST | `/recurring-contracts` | admin ou empresa |
| GET | `/recurring-contracts/{id}` | autenticado (escopo) |
| PATCH | `/recurring-contracts/{id}` | admin ou empresa dona |
| DELETE | `/recurring-contracts/{id}` | admin |
| POST | `/recurring-contracts/{id}/creators` | admin ou empresa |
| POST | `/recurring-contracts/{id}/items` | admin ou empresa (pauta) |
| PATCH | `/content-planning-items/{id}` | autenticado (criador envia `submission_url`; agência/empresa aprova/publica) |
| DELETE | `/content-planning-items/{id}` | admin ou empresa |

## Notificações e admins

| Método | Caminho | Quem |
|---|---|---|
| GET | `/notifications` | autenticado (admin vê todas; demais só as suas) |
| PATCH | `/notifications/{id}/read` | autenticado |
| POST | `/notifications/read-all` | autenticado |
| DELETE | `/notifications/{id}` | autenticado |
| GET | `/admin-users` | admin |
| POST | `/admin-users` | admin |
| DELETE | `/admin-users/{id}` | admin (não pode remover a si) |

Notificações são gravadas no servidor em eventos (aprovar creator/empresa, candidatura, revisão de entrega, nova pauta).

## Fora desta leva

Upload multipart, transcode Express, reset de banco do legado, Google-complete além do que já existe, exportação LGPD.
