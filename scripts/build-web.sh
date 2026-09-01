#!/usr/bin/env bash
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPTS_DIR/.." && pwd)"
WEB_ROOT="$REPO_ROOT/rocktz-web"
API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000/api}"
APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
DEPLOY=0
BUMP=1

usage() {
  cat <<EOF
Gera o front estático para cPanel (HTML/JS/CSS, sem Node).

Uso:
  ./scripts/build-web.sh
  ./scripts/build-web.sh --api https://api.creatorz.digital/api --app https://creatorz.digital
  ./scripts/build-web.sh --api https://api.creatorz.digital/api --app https://creatorz.digital --deploy

Opções:
  --api URL   NEXT_PUBLIC_API_URL (API Laravel, com /api no final)
  --app URL   NEXT_PUBLIC_APP_URL (domínio do site)
  --deploy    envia dist-cpanel para o FTP creatorsrocketz (inclui .htaccess)
  --no-bump   não incrementa a versão do rodapé (package.json)
  -h, --help  mostra esta ajuda

Saída:
  rocktz-web/dist-cpanel/     pasta para enviar ao public_html
  rocktz-web-cpanel.zip       zip na raiz do monorepo (arquivos na raiz do zip)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api)
      API_URL="${2:?informe a URL da API}"
      shift 2
      ;;
    --app)
      APP_URL="${2:?informe a URL do site}"
      shift 2
      ;;
    --deploy)
      DEPLOY=1
      shift
      ;;
    --no-bump)
      BUMP=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opção desconhecida: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$WEB_ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm não encontrado. Instale Node 22+." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Instalando dependências..."
  npm install
fi

if [[ "$BUMP" -eq 1 ]]; then
  echo "Incrementando versão do rodapé (patch)…"
  npm version patch --no-git-tag-version
fi

APP_VERSION="$(node -p "require('./package.json').version")"
echo "Build estático"
echo "  API: $API_URL"
echo "  APP: $APP_URL"
echo "  Versão: $APP_VERSION"

export NEXT_PUBLIC_API_URL="$API_URL"
export NEXT_PUBLIC_APP_URL="$APP_URL"
export NEXT_PUBLIC_APP_VERSION="$APP_VERSION"

npm run build
node "$SCRIPTS_DIR/package-cpanel.mjs"

if [[ ! -f dist-cpanel/.htaccess ]]; then
  echo "Erro: dist-cpanel/.htaccess não foi copiado." >&2
  exit 1
fi

if [[ ! -f dist-cpanel/index.html ]]; then
  echo "Erro: dist-cpanel/index.html não foi gerado." >&2
  exit 1
fi

ZIP="$REPO_ROOT/rocktz-web-cpanel.zip"
rm -f "$ZIP"
# Conteúdo na raiz do zip (não dist-cpanel/...), incluindo .htaccess
( cd dist-cpanel && zip -r -q "$ZIP" . )

if ! unzip -l "$ZIP" | grep -q '\.htaccess'; then
  echo "Erro: o zip ficou sem .htaccess." >&2
  exit 1
fi

echo
echo "Pronto."
echo "  Pasta: $WEB_ROOT/dist-cpanel"
echo "  Zip:   $ZIP"
echo
echo "O Pro Deployer não envia .htaccess (arquivo oculto). Publique com:"
echo "  ./scripts/deploy-web.sh"
echo "A API Laravel continua como PHP em outro domínio/subdomínio."
echo "No .env da API: FRONTEND_URL=$APP_URL"

if [[ "$DEPLOY" -eq 1 ]]; then
  "$SCRIPTS_DIR/deploy-web.sh"
fi
