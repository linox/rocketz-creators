# Auditoria do legado

Fonte: `legado/Rocketz-Creator-main`.

## Stack

React 19, Vite 6, React Router 7, Tailwind v4, Firebase Auth/Firestore, Express + multer + ffmpeg para mídia. Sem API de negócio.

## Rotas por papel

- Público: `/`, `/join` (landing), `/login`
- Criador: perfil `/creators/:id`, campanhas disponíveis, recorrência, notificações
- Empresa: `/company-dashboard`, entregas, recorrência, perfil de criador (leitura)
- Admin: dashboard `/`, criadores, empresas, campanhas, detalhe, entregas, recorrência, admin users

## Coleções Firestore

`creators`, `companies`, `companyUsers`, `campaigns`, `campaigns/{id}/creators`, `campaignCreators` (espelho), `recurringContracts`, `contentPlanning`, `notifications`, `media_files` (+ chunks), `settings` (não usado), `test/connection`.

Regras: leitura pública na maior parte; escrita se autenticado. Autorização real era só no React.

## Dívidas

- Status admin `approved` fora do enum de criador (`review|active|paused|rejected`)
- Notificações de empresa filtradas como criador
- Métricas às vezes em `signature.metrics` e às vezes em `content.metrics`
- Upload em disco + backup base64 no Firestore
- Contrato eletrônico e LGPD só no cliente
