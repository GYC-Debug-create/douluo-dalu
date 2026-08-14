#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/apps/douluo"
ARCHIVE="/tmp/douluo-responsive-code-20260813.tar.gz"
BACKUP_DIR="/opt/apps/douluo-backups"

if [[ "$(readlink -f "$APP_DIR")" != "$APP_DIR" ]]; then
  echo "Unexpected application directory: $APP_DIR" >&2
  exit 1
fi

stamp="$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$BACKUP_DIR"

cd "$APP_DIR"
sudo tar -czf "$BACKUP_DIR/frontend-code-$stamp.tar.gz" \
  frontend/dist/index.html \
  frontend/dist/assets/*.js \
  frontend/dist/assets/*.css

sudo tar -xzf "$ARCHIVE" -C "$APP_DIR"
sudo docker compose -f docker-compose.production.yml build
sudo docker compose -f docker-compose.production.yml up -d

healthy=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/health > /tmp/douluo-health.json; then
    healthy=1
    break
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  echo "Application health check failed" >&2
  exit 1
fi

cat /tmp/douluo-health.json
sudo docker ps --filter name=douluo-game-app --format '{{.Names}} {{.Status}} {{.Ports}}'
sudo rm -f \
  /tmp/douluo-responsive-20260813.tar.gz \
  /tmp/douluo-responsive-code-20260813.tar.gz \
  /tmp/update-responsive.sh
