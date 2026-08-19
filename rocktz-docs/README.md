# Rocketz Creators — Documentação

Índice da refatoração (React/Next.js + Laravel + MySQL). O legado em `legado/` permanece só como referência.

- [01. Visão geral](01-visao-geral.md)
- [02. Auditoria do legado](02-auditoria-legado.md)
- [03. Modelo de domínio](03-modelo-de-dominio.md)
- [04. Auth e RBAC](04-auth-e-rbac.md)
- [05. Banco de dados](05-banco-de-dados.md)
- [06. API](06-api.md)
- [07. Frontend](07-frontend.md)
- [08. Setup](08-setup.md)
- [Decisões](decisoes.md)

## Pastas do monorepo

- `legado/` — app original (React + Firebase + Express). Não evolui.
- `rocktz-api/` — API Laravel 13 + Sanctum + MySQL.
- `rocktz-web/` — front Next.js (App Router).
- `rocktz-docs/` — esta documentação.
- `scripts/` — build do front estático para cPanel.
