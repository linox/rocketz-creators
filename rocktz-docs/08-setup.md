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
./scripts/build-web.sh --api https://apicreators.rocketz.me/api --app https://seudominio.com.br
```

Gera `rocktz-web/dist-cpanel/` e `rocktz-web-cpanel.zip`. Envie o conteúdo de `dist-cpanel` para o `public_html` (com o `.htaccess`).

No `.env` da API em produção:

```
APP_URL=https://apicreators.rocketz.me
FRONTEND_URL=https://creators.rocketz.me
DB_DATABASE=apicreators_db
GOOGLE_REDIRECT_URI=https://apicreators.rocketz.me/api/auth/google/callback

MAIL_MAILER=resend
RESEND_API_KEY=re_xxxxx
MAIL_FROM_ADDRESS=naoresponda@rocketz.me
MAIL_FROM_NAME="Rocketz Creators"
```

O domínio do `MAIL_FROM_ADDRESS` precisa estar verificado no Resend. Sem a chave, `POST /auth/forgot-password` responde 503.

Localmente o mailer fica em `log` (`rocktz-api/storage/logs/laravel.log`).

Depois de alterar o `.env` em produção: `php artisan config:clear`.

## Contas

Senha `password`. Ver [05-banco-de-dados.md](05-banco-de-dados.md).

Google OAuth só funciona com `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` da API. Sem isso, o redirect responde 503.
