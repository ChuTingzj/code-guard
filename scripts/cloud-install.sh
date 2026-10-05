#!/usr/bin/env bash
# Cloud Agent install: idempotent, one-time repository + system setup.
# Prepares system services (PostgreSQL + pgvector, Redis), Node dependencies,
# the shared package build, and the generated Prisma client. Safe to re-run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> [install] Ensuring system packages (PostgreSQL 16 + pgvector, Redis)"
if ! command -v psql >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    postgresql-16 postgresql-16-pgvector redis-server
else
  echo "    system packages already present, skipping apt install"
fi

echo "==> [install] Ensuring .env exists"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    created .env from .env.example"
else
  echo "    .env already present"
fi

echo "==> [install] Installing Node dependencies (pnpm $(pnpm -v))"
pnpm install --frozen-lockfile

echo "==> [install] Building shared package"
pnpm --filter @code-guard/shared build

echo "==> [install] Generating Prisma client"
pnpm db:generate

echo "==> [install] Done"
