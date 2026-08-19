# Banco de dados (MySQL 8)

Database: `rocktz_creators`  
Charset: `utf8mb4_unicode_ci`  
Connection: `root` @ `127.0.0.1` (senha vazia no local)

## Comando

```bash
cd rocktz-api
php artisan migrate:fresh --seed
```

## Contas de teste (senha: `password`)

- `admin@rocketz.test` — admin
- `ana.creator@rocketz.test` — criador active (portfólio + contrato)
- `bruno.creator@rocketz.test` — criador review
- `camila.creator@rocketz.test` — criador paused
- `diego.creator@rocketz.test` — criador rejected
- `empresa@rocketz.test` — empresa active (Marca Aurora)
- `pending.empresa@rocketz.test` — empresa pending (Studio Lumen)

O seed ainda cria campanhas em vários status, um contrato recorrente, notificações, consents LGPD e registros de mídia.

## Tabelas

Auth: `users`, `password_reset_tokens`, `sessions`, `personal_access_tokens`  
Pessoas: `creators`, `creator_portfolio_videos`, `creator_contract_acceptances`, `companies`, `company_contacts`, `company_users`, `company_favorite_creators`, `consents`  
Campanhas: `campaigns`, `campaign_briefings`, `campaign_deliverables`, `campaign_creators`, `campaign_creator_contents`  
Recorrência: `recurring_contracts`, `recurring_contract_creators`, `content_planning_items`  
Transversal: `notifications`, `media_files`

Status são `VARCHAR` + PHP Enum (não ENUM nativo).
