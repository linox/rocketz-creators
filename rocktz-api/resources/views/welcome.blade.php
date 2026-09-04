<!DOCTYPE html>
<html lang="pt-BR">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="robots" content="noindex">
        <title>{{ config('app.name', 'Creatorz by Rocketz') }} · API</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230F172A'/%3E%3Ctext x='16' y='22' text-anchor='middle' font-family='Inter,sans-serif' font-size='18' font-weight='900' fill='%23a78bfa'%3Ez%3C/text%3E%3C/svg%3E">
        <style>
            :root {
                --bg: #0f172a;
                --card: #111827;
                --border: rgba(255, 255, 255, 0.1);
                --text: #f8fafc;
                --muted: #94a3b8;
                --brand: #6366f1;
                --brand-hover: #818cf8;
                --ok: #34d399;
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }

            html, body { min-height: 100%; }

            body {
                font-family: Inter, ui-sans-serif, system-ui, sans-serif;
                background: var(--bg);
                color: var(--text);
                -webkit-font-smoothing: antialiased;
            }

            .page {
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 2.5rem 1rem;
                position: relative;
                overflow: hidden;
            }

            .glow {
                position: absolute;
                width: 28rem;
                height: 28rem;
                border-radius: 9999px;
                background: radial-gradient(circle, rgba(99, 102, 241, 0.22), transparent 70%);
                filter: blur(12px);
                pointer-events: none;
            }

            .glow-a { top: -8rem; right: -6rem; }
            .glow-b { bottom: -10rem; left: -8rem; background: radial-gradient(circle, rgba(168, 85, 247, 0.16), transparent 70%); }

            .card {
                position: relative;
                width: 100%;
                max-width: 36rem;
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 1.5rem;
                padding: 2.5rem 2rem;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
            }

            .logo {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                user-select: none;
                margin-bottom: 1.75rem;
            }

            .logo-word {
                font-weight: 900;
                font-size: 2.45rem;
                letter-spacing: -0.04em;
                line-height: 1;
                color: #fff;
            }

            .logo-z { color: #c084fc; }

            .logo-sub {
                margin-top: -0.35rem;
                font-weight: 900;
                font-size: 0.85rem;
                letter-spacing: 0.27em;
                padding-left: 0.27em;
                text-transform: uppercase;
                color: #94a3b8;
            }

            .badge {
                display: inline-flex;
                align-items: center;
                gap: 0.4rem;
                margin: 0 auto 1.25rem;
                padding: 0.35rem 0.75rem;
                border-radius: 9999px;
                border: 1px solid rgba(99, 102, 241, 0.35);
                background: rgba(99, 102, 241, 0.12);
                color: var(--brand-hover);
                font-size: 0.7rem;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
            }

            .hero { text-align: center; }

            h1 {
                font-size: 1.35rem;
                font-weight: 700;
                letter-spacing: -0.02em;
                margin-bottom: 0.5rem;
            }

            .lead {
                color: var(--muted);
                font-size: 0.95rem;
                line-height: 1.55;
                max-width: 28rem;
                margin: 0 auto 1.75rem;
            }

            .status {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.55rem;
                margin-bottom: 1.75rem;
                font-size: 0.85rem;
                color: var(--muted);
            }

            .dot {
                width: 0.55rem;
                height: 0.55rem;
                border-radius: 9999px;
                background: #64748b;
                box-shadow: 0 0 0 4px rgba(100, 116, 139, 0.2);
            }

            .dot.ok {
                background: var(--ok);
                box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.18);
            }

            .dot.err {
                background: #f87171;
                box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.18);
            }

            .endpoints {
                display: grid;
                gap: 0.65rem;
                margin-bottom: 1.75rem;
            }

            .endpoint {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.85rem 1rem;
                border-radius: 0.85rem;
                border: 1px solid var(--border);
                background: rgba(30, 41, 59, 0.4);
                text-decoration: none;
                color: inherit;
                transition: border-color 0.15s ease, background 0.15s ease;
            }

            .endpoint:hover {
                border-color: rgba(99, 102, 241, 0.45);
                background: rgba(99, 102, 241, 0.08);
            }

            .method {
                flex-shrink: 0;
                font-size: 0.68rem;
                font-weight: 800;
                letter-spacing: 0.06em;
                color: var(--brand-hover);
                background: rgba(99, 102, 241, 0.16);
                border-radius: 0.4rem;
                padding: 0.22rem 0.45rem;
            }

            .path {
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: 0.82rem;
            }

            .hint {
                margin-left: auto;
                font-size: 0.72rem;
                color: var(--muted);
            }

            .cta {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 0.75rem;
            }

            .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 2.75rem;
                padding: 0 1.15rem;
                border-radius: 0.75rem;
                font-size: 0.875rem;
                font-weight: 700;
                text-decoration: none;
                transition: background 0.15s ease, border-color 0.15s ease;
            }

            .btn-primary {
                background: #7c3aed;
                color: #fff;
            }

            .btn-primary:hover { background: #6d28d9; }

            .btn-ghost {
                border: 1px solid var(--border);
                color: #e2e8f0;
                background: transparent;
            }

            .btn-ghost:hover { border-color: rgba(255, 255, 255, 0.22); }

            footer {
                margin-top: 1.75rem;
                text-align: center;
                font-size: 0.75rem;
                color: #64748b;
            }
        </style>
    </head>
    <body>
        <div class="page">
            <div class="glow glow-a" aria-hidden="true"></div>
            <div class="glow glow-b" aria-hidden="true"></div>

            <main class="card">
                <div class="logo" aria-label="Creatorz by Rocketz">
                    <div class="logo-word">rocket<span class="logo-z">z</span></div>
                    <div class="logo-sub">Creators</div>
                </div>

                <div class="hero">
                    <div class="badge">API</div>
                    <h1>Backend da plataforma</h1>
                    <p class="lead">
                        Esta é a API do Creatorz by Rocketz — casting, campanhas e trabalhos recorrentes entre marcas e criadores.
                    </p>
                </div>

                <div class="status" id="status">
                    <span class="dot" id="status-dot"></span>
                    <span id="status-label">Verificando serviço…</span>
                </div>

                <div class="endpoints">
                    <a class="endpoint" href="{{ url('/api/health') }}">
                        <span class="method">GET</span>
                        <span class="path">/api/health</span>
                        <span class="hint">status</span>
                    </a>
                </div>

                <div class="cta">
                    <a class="btn btn-primary" href="{{ config('app.frontend_url') }}">Ir para a plataforma</a>
                    <a class="btn btn-ghost" href="{{ url('/api/health') }}">Checar health</a>
                </div>

                <footer>
                    {{ config('app.name') }} · Laravel {{ app()->version() }}
                </footer>
            </main>
        </div>

        <script>
            (function () {
                var dot = document.getElementById('status-dot');
                var label = document.getElementById('status-label');

                fetch(@json(url('/api/health')), { headers: { Accept: 'application/json' } })
                    .then(function (response) { return response.ok ? response.json() : Promise.reject(); })
                    .then(function (data) {
                        var ok = data && data.status === 'ok';
                        dot.className = 'dot ' + (ok ? 'ok' : 'err');
                        label.textContent = ok ? 'Serviço online' : 'Serviço indisponível';
                    })
                    .catch(function () {
                        dot.className = 'dot err';
                        label.textContent = 'Não foi possível verificar o status';
                    });
            })();
        </script>
    </body>
</html>
