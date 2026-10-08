#!/usr/bin/env bash
# Build the site and rsync dist/ to the web server.
# Uses SSH keys (ssh-copy-id user@host once) instead of typing passwords.
#
#   DEPLOY_HOST=1.2.3.4 ./scripts/deploy.sh
#
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-orangepi}"
DEPLOY_HOST="${DEPLOY_HOST:?set DEPLOY_HOST, e.g. DEPLOY_HOST=1.2.3.4 ./scripts/deploy.sh}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/hugo}"
SITE_URL="https://hhikr.moe"

cd "$(dirname "$0")/.."

echo "🚧 building..."
npm run build

echo "📤 uploading to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}"
rsync -avz --delete ./dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/"

echo "✅ deployed: ${SITE_URL}"
