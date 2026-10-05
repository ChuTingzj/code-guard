#!/usr/bin/env bash
# Cloud Agent start: per-boot service reconciliation. Idempotent and returns.
# Starts PostgreSQL + Redis, ensures the role/database exist, and applies
# migrations + seed. Dev servers run separately as long-lived terminals.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi

PGPASS="${POSTGRES_PASSWORD:-codeguard}"
PGDB="codeguard"

echo "==> [start] Starting PostgreSQL 16 cluster"
sudo pg_ctlcluster 16 main start 2>/dev/null || true
for i in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done
sudo -u postgres pg_isready

echo "==> [start] Ensuring Redis is running"
if ! redis-cli ping >/dev/null 2>&1; then
  sudo redis-server /etc/redis/redis.conf --daemonize yes || redis-server --daemonize yes
fi
for i in $(seq 1 30); do
  if redis-cli ping >/dev/null 2>&1; then break; fi
  sleep 1
done
redis-cli ping

echo "==> [start] Ensuring role password and database"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '${PGPASS}';"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${PGDB}'" | grep -q 1; then
  sudo -u postgres createdb -O postgres "${PGDB}"
fi

echo "==> [start] Applying migrations + seed"
pnpm db:migrate
pnpm db:seed

echo "==> [start] Ready. API :${PORT:-3001} | Web :3000 | Bull Board /admin/queues"
