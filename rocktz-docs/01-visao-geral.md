# Visão geral

Rocketz Creators é a plataforma da agência para casting de criadores, campanhas pontuais, trabalhos recorrentes e fluxo de aprovação de conteúdo.

## Papéis

- **admin** — operação da agência (criadores, empresas, campanhas, entregas, recorrência, usuários).
- **company** — portal da marca (campanhas, favoritos, aprovação de conteúdo).
- **creator** — perfil, candidaturas, envio de script/vídeo, recorrência.

Cadastro de criador entra em `review`. Cadastro de empresa entra em `pending`. Ambos já acessam o portal; a aprovação admin é fase posterior.

## O que sai do legado

- Firebase Auth e Firestore
- Express de upload/transcode (fase posterior no Laravel)
- `manualPassword` em texto no documento do criador
- Dual storage `campaigns/{id}/creators` + `campaignCreators`
- Whitelist de e-mails admin no código

## O que entra

- `rocktz-api` — Laravel 13 + Sanctum + MySQL 8
- `rocktz-web` — Next.js App Router + Tailwind v4
- `rocktz-docs` — documentação da refatoração
- Schema completo no dia 1, com seeders de teste
