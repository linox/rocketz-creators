# Credenciais de teste

Senha padrão de todas as contas: `password`

Geradas por `php artisan migrate:fresh --seed` em `rocktz-api`.

## Admin

| Campo | Valor |
|---|---|
| Nome | Admin Rocketz |
| E-mail | `admin@rocketz.test` |
| Senha | `password` |
| Papel | admin |
| Destino | `/dashboard` |

## Criadores

| E-mail | Nome | Status | Cidade | Destino |
|---|---|---|---|---|
| `ana.creator@rocketz.test` | Ana UGC (Ana Beatriz Oliveira) | active | São Paulo / SP | `/creators/{id}` |
| `bruno.creator@rocketz.test` | Bruno Costa | review | Rio de Janeiro / RJ | `/creators/{id}` |
| `camila.creator@rocketz.test` | Camila Ferreira | paused | Belo Horizonte / MG | `/creators/{id}` |
| `diego.creator@rocketz.test` | Diego Santos | rejected | Curitiba / PR | `/creators/{id}` |

Ana é o perfil completo (portfólio, contrato aceito, Pix, Instagram `@ana.ugc`). Senha de todos: `password`.

## Empresas

| E-mail | Empresa | Status | Cidade | Destino |
|---|---|---|---|---|
| `empresa@rocketz.test` | Marca Aurora | active | São Paulo | `/company-dashboard` |
| `pending.empresa@rocketz.test` | Studio Lumen | pending | Rio de Janeiro | `/company-dashboard` |

Senha de ambas: `password`.

Contatos da Aurora (não são login):

- Marina Alves — Head de Marketing — `marina@aurora.test`
- Pedro Lima — Analista de Influência — `pedro@aurora.test`

## Uso rápido

```
admin@rocketz.test              password    admin
ana.creator@rocketz.test        password    criador active
bruno.creator@rocketz.test      password    criador review
camila.creator@rocketz.test     password    criador paused
diego.creator@rocketz.test      password    criador rejected
empresa@rocketz.test            password    empresa active
pending.empresa@rocketz.test    password    empresa pending
```

Só para ambiente local / homologação. Não usar em produção.
