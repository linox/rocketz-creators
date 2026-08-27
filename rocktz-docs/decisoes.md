# Decisões

1. **Next.js App Router** em vez de Vite SPA, para landing com App Router e BFF de auth.
2. **Laravel 13 + Sanctum token**, não cookie SPA do Sanctum — origens separadas (`:3000` e `:8000`).
3. **MySQL 8** com schema completo no dia 1 e seeders de teste.
4. **Sem Firebase**. Papel em `users.role`.
5. **Sem Socialite**: o pacote ainda exige Guzzle 7; Laravel 13 traz Guzzle 8. Google OAuth usa HTTP client nativo.
6. **Sem `manualPassword`**. Reset de senha padrão.
7. **Uma tabela `campaign_creators`**, sem dual Firestore.
8. **Status como VARCHAR + PHP Enum**, para evoluir sem `ALTER` de ENUM nativo.
9. **Token Sanctum no `localStorage` do front estático**, para publicar no cPanel sem Node (mesmo modelo do educarmais.online-web).
10. **`legado/` permanece** somente leitura.
11. **E-mail transacional via Resend** (`MAIL_MAILER=resend`). Reset de senha no idioma de `users.locale` (fallback `Accept-Language` / `pt-BR`), link no front (`/reset-password?token=&email=`).
12. **Mídia nesta leva = URL** (Drive, YouTube, Instagram, arquivo hospedado). Upload multipart e transcode ficam para a sequência.
13. **Front estático** (`output: "export"`). Rotas dinâmicas geram `id: "_"` e o Apache reescreve `/creators/{id}`, `/campaigns/{id}`, `/recurring/{id}`.
14. **i18n no cliente** (`i18next`), sem prefixo `/pt` `/en` na URL (export estático para cPanel). Idiomas: `pt-BR` (padrão), `en`, `es`. Persistência em `localStorage` (`rocktz_locale`) e `users.locale`. A API responde no idioma de `Accept-Language` (`pt-BR` | `en` | `es`). Marca, UF, CNPJ, máscaras BR e o termo **LGPD** não traduzem. Conteúdo gerado pelo usuário (bio, briefing, nome de campanha) também não.
15. **App dos criadores em Flutter** (iOS + Android), pasta `rocktz-mobile`. Reusa o mesmo `/api` Sanctum. Push via FCM HTTP v1 (APNs pelo FCM). Sem API mobile versionada no início.
