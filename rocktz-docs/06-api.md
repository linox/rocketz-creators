# API

Base: `http://localhost:8000/api`  
Auth: `Authorization: Bearer {token}` (o Next.js usa cookie httpOnly e não expõe o token no browser)

## Fase 1 (implementado)

| Método | Caminho | Auth |
|---|---|---|
| GET | `/health` | público |
| POST | `/auth/register/creator` | público |
| POST | `/auth/register/company` | público |
| POST | `/auth/login` | público |
| POST | `/auth/forgot-password` | público |
| POST | `/auth/reset-password` | público |
| GET | `/auth/google/redirect` | público |
| GET | `/auth/google/callback` | público |
| POST | `/auth/logout` | sanctum |
| GET | `/auth/me` | sanctum |
| POST | `/auth/google/complete` | sanctum |

Resposta de login/register:

```json
{
  "token": "...",
  "user": {
    "id": 1,
    "name": "...",
    "email": "...",
    "role": "creator",
    "creator": { "id": 1, "artistic_name": "...", "status": "review" },
    "company": null
  }
}
```

## Próximas fases (schema já existe)

CRUD de criadores/empresas (aprovação admin), campanhas, candidaturas, entregas (script/vídeo), recorrência/planning, notificações, mídia/upload, termo de adesão, exportação LGPD.
