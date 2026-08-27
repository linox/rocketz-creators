# Setup local

Requisitos: PHP 8.5+, Composer, Node 22+, MySQL 8/9, npm.

## Banco

```bash
mysql -u root -e "CREATE DATABASE IF NOT EXISTS rocktz_creators CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

## API

```bash
cd rocktz-api
cp .env.example .env   # já aponta para MySQL rocktz_creators
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve --host=127.0.0.1 --port=8000
```

Em banco já existente: `php artisan migrate` e `php artisan db:seed --class=MailTemplateSeeder` para criar as colunas de 2FA e o template `auth.two_factor`.

## Web

```bash
cd rocktz-web
cp .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Build para cPanel (HTML estático, sem Node)

Na raiz do monorepo:

```bash
./scripts/build-web.sh
```

Produção (a URL da API entra no HTML na hora do build):

```bash
./scripts/build-web.sh --api https://api.creatorz.digital/api --app https://creatorz.digital
```

Gera `rocktz-web/dist-cpanel/` e `rocktz-web-cpanel.zip`. Envie o conteúdo de `dist-cpanel` para o `public_html` (com o `.htaccess`).

No `.env` da API em produção:

```
APP_URL=https://api.creatorz.digital
FRONTEND_URL=https://creatorz.digital
DB_DATABASE=apicreators_db
GOOGLE_REDIRECT_URI=https://api.creatorz.digital/api/auth/google/callback

MAIL_MAILER=resend
RESEND_API_KEY=re_xxxxx
RESEND_WEBHOOK_SECRET=
MAIL_FROM_ADDRESS=naoresponda@rocketz.me
MAIL_FROM_NAME="Creatorz by Rocketz"
MAIL_SUPPORT_ADDRESS=contato@rocketzmkt.com.br
# MAIL_ENABLED=false  # pausa todos os envios (teste local)
```

O domínio do `MAIL_FROM_ADDRESS` precisa estar verificado no Resend. Sem a chave, `POST /auth/forgot-password` responde 503.

Código 2FA e reset de senha são prioridade: saem **na hora** da requisição (não entram na fila). Os demais e-mails transacionais vão para a fila `default`. Com a API no ar:

```bash
cd rocktz-api
php artisan queue:work --queue=high,default
php artisan schedule:work   # local: lembretes a cada hora + alertas admin 08:00
```

Em produção, rode o worker e o scheduler (`* * * * * php artisan schedule:run`) o tempo todo. Sem o worker, cadastro, aprovação e reset de senha gravam `mail_messages` mas o Resend não dispara. Admin: `/mail` (templates + interruptor global de envio) e `/mail/log`. Para testar o app sem disparar e-mail, desligue **Envio de e-mails** em `/mail`, ou use `MAIL_ENABLED=false` no `.env`. Teste um envio em Templates → Enviar teste.

Webhook público: `POST /api/webhooks/resend` (header `X-Resend-Webhook-Secret` ou `svix-signature` = `RESEND_WEBHOOK_SECRET`).

Depois de alterar o `.env` em produção: `php artisan config:clear`.

## Cloudflare R2 (mídia em produção)

O upload local usa o bucket `creatorz`. O servidor precisa das **mesmas** variáveis; sem elas o player em `https://creatorz.digital` recebe 404/403.

No `.env` da API em produção:

```
MEDIA_DISK=r2
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=creatorz
R2_ENDPOINT=https://6c33ae417c3fd3f476e02ec0c51d3c5f.r2.cloudflarestorage.com
R2_REGION=auto
APP_URL=https://api.creatorz.digital
FRONTEND_URL=https://creatorz.digital
```

Depois:

```bash
cd rocktz-api
php artisan migrate
php artisan config:clear
php artisan media:health
```

`media:health` tem que mostrar `r2_configured=yes` e `r2_signed_get=ok`. O frontend de produção precisa ser rebuildado (`./scripts/build-web.sh --api https://api.creatorz.digital/api --app https://creatorz.digital`) **depois** deste código ir para o servidor.

O CORS do bucket R2 deve incluir a origem `https://creatorz.digital`.

## Contas de teste em produção

Depois do `migrate` no servidor (sem `fresh`):

```bash
cd rocktz-api
php artisan demo:seed --force
```

Cria as mesmas contas do ambiente local (senha `password`) se ainda não existirem: admin, criadores Ana/Bruno/Camila/Diego, empresas Aurora e Lumen, campanhas, contrato recorrente e templates de e-mail. Não apaga usuários reais. Lista completa em [05-banco-de-dados.md](05-banco-de-dados.md).

Google OAuth só funciona com `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` da API. Sem isso, o redirect responde 503.
