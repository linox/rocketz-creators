# Decisões

1. **Next.js App Router** em vez de Vite SPA, para landing com App Router e BFF de auth.
2. **Laravel 13 + Sanctum token**, não cookie SPA do Sanctum — origens separadas (`:3000` e `:8000`).
3. **MySQL 8** com schema completo no dia 1 e seeders de teste.
4. **Sem Firebase**. Papel em `users.role`.
5. **Sem Socialite**: o pacote ainda exige Guzzle 7; Laravel 13 traz Guzzle 8. Google OAuth usa HTTP client nativo.
6. **Sem `manualPassword`**. Reset de senha padrão.
7. **Uma tabela `campaign_creators`**, sem dual Firestore.
8. **Status como VARCHAR + PHP Enum**, para evoluir sem `ALTER` de ENUM nativo.
9. **Cookie httpOnly no Next** para o token Laravel.
10. **`legado/` permanece** somente leitura.
