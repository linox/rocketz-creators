# App dos criadores (Flutter)

App nativo iOS/Android em [`rocktz-mobile`](../rocktz-mobile). Só o papel **creator**. Marcas e agência continuam no web.

Auth: o mesmo Sanctum do web (`Authorization: Bearer` + `X-Auth-Token` + `Accept-Language: pt-BR|en|es`). Base: `http://localhost:8000/api` em debug, `https://api.creatorz.digital/api` em release.

Quando o design visual chegar, cruzar cada tela do Figma com a tabela abaixo: **API** = já existe; **gap** = precisa de backend; **visual** = só layout.

## Bottom nav (proposta)

| Tab | Telas | Endpoints |
|---|---|---|
| Início | Home / dashboard | `GET /dashboard`, `GET /nav`, `GET /auth/me` |
| Oportunidades | Lista + detalhe + candidatar | `GET /campaigns/available`, `GET /campaigns/{id}`, `POST /campaigns/{id}/apply` |
| Trabalhos | Minhas campanhas + recorrência | `GET /campaigns`, `GET /campaigns/{id}`, `GET /recurring-contracts`, `GET /recurring-contracts/{id}` |
| Avisos | Inbox | `GET /notifications`, `PATCH /notifications/{id}/read`, `POST /notifications/read-all` |
| Conta | Media kit, PIX, contrato, idioma | `GET\|PATCH /creators/{id}`, `POST /creators/{id}/contract`, `PATCH /auth/locale`, `POST /auth/logout` |

## Mapa tela → API (MVP)

| Tela App | Campos / ações | Endpoint | Status |
|---|---|---|---|
| Login | email, senha | `POST /auth/login` | API |
| Código 2FA | challenge + 6 dígitos | `POST /auth/two-factor/verify`, `POST /auth/two-factor/resend` | API (fluxo já existe; no App entra no MVP para quem já tem 2FA no web) |
| Cadastro criador | mesmos campos do web | `POST /auth/register/creator` | API |
| Esqueci senha | email | `POST /auth/forgot-password` (link abre o **web**) | API |
| Home | KPIs, gráficos de audiência/candidaturas, honorários PIX, contrato pendente | `GET /dashboard` (`audience`, `activity`, `fees` + KPIs), `GET /auth/me` | API |
| Campanhas disponíveis | lista, filtro implícito geo | `GET /campaigns/available` | API |
| Detalhe oportunidade | briefing, entregáveis, candidatar (`notes`) | `GET /campaigns/{id}`, `POST /campaigns/{id}/apply` | API. Gate: `active` + contrato |
| Minhas campanhas | status candidatura / pagamento | `GET /campaigns` (escopo próprio) | API |
| Detalhe campanha (trabalho) | briefing + script + vídeo + link | `GET /campaigns/{id}`, `PATCH /campaign-creators/{id}` | API. Payload restrito: `script`, `video_url`, `published_link`, `delivery_status` `sent\|published` |
| Upload de vídeo | câmera/galeria | `POST /media/uploads` → chunks → `POST /media/uploads/{id}` (+ `submission`) | API |
| Recorrência | lista de contratos | `GET /recurring-contracts` | API |
| Pauta | briefing, envio URL/mídia | `GET /recurring-contracts/{id}`, `PATCH /content-planning-items/{id}` | API |
| Notificações | lista, marcar lida | `GET /notifications`, `PATCH …/read`, `POST …/read-all` | API. Badge: `GET /nav` |
| Contrato de adesão | nome, documento, e-mail | `POST /creators/{id}/contract` | API |
| Media kit | bio, redes, categorias, PIX | `GET\|PATCH /creators/{id}` | API. Criador **não** envia `status`, `metrics`, `internal_notes` |
| Idioma | PT / EN / ES | `PATCH /auth/locale` | API |
| Logout | — | `POST /auth/logout` | API |

## Fase 2 (App) — já na API web, adiar no celular

| Tela | Endpoint | Gap no App |
|---|---|---|
| Portfólio | `POST\|DELETE /creators/{id}/portfolio` | Upload grande; pode ficar no web |
| Sync redes | `POST\|GET /creators/{id}/social-sync` | Nice to have |
| Preferências de e-mail | `GET\|PATCH /notification-preferences` | Settings |
| Google login | `GET /auth/google/redirect` + complete | SHA / URL schemes |
| Landing da marca | `POST /landings/{slug}/claim` | Deep link |

## Push (Fase 2 de produto, backend já no plano)

| Tela / evento | Endpoint | Gap |
|---|---|---|
| Registrar aparelho | `POST /device-tokens` `{ token, platform }` | Novo (este documento) |
| Remover aparelho | `DELETE /device-tokens` `{ token }` | Novo |
| Entrega | Job FCM HTTP v1 (iOS via APNs pelo FCM) | Credenciais `FCM_*` no `.env`. Sem elas o job não envia. |

`data` do push: `notification_id`, `type`, `link`, `campaign_id`, `recurring_contract_id`. O App abre a rota web equivalente (`/campaigns/{id}`, `/recurring/{id}`, `/notifications`).

## Fora do App (não mapear no Figma de criador)

Criar/editar campanha, aprovar candidatura, marcar PIX pago, métricas da campanha, casting, landing CMS, mail, favoritos, chat, saque automático, KYC com documento.

Qualquer tela dessas no design é **produto + API**, não só UI.

## Upload (cliente Flutter)

Espelha [`rocktz-web/src/lib/laravel.ts`](../rocktz-web/src/lib/laravel.ts):

1. `POST /media/uploads` com `filename`, `size`, `mime_type`, opcional `submission: { type, id, payload }`.
2. Se `part_urls` (R2): `PUT` presigned por parte, guardar `ETag`. Senão: `POST /media/uploads/{id}/chunks/{index}` `application/octet-stream`.
3. `POST /media/uploads/{id}` com `{ parts: [{ index, etag }] }` se R2.
4. Poll `GET /media/uploads/{id}` enquanto `uploading` / `processing`.
5. `DELETE /media/uploads/{id}` para cancelar.

Limite de vídeo: 1 GiB. Chunk padrão: 4 MiB. Threshold para chunked no web: 2 MiB (o App usa chunked para vídeo sempre).

`submission.type`: `campaign_creator` ou `content_planning_item`.
