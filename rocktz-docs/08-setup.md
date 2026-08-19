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

## Contas

Senha `password`. Ver [05-banco-de-dados.md](05-banco-de-dados.md).

Google OAuth só funciona com `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` da API. Sem isso, o redirect responde 503.

E-mail de reset usa `MAIL_MAILER=log` (aparece em `rocktz-api/storage/logs/laravel.log`).
