#!/usr/bin/env bash
# 使用 docker-compose.registry.yml 中指定的镜像启动 Web / Worker（不本地 build）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

COMPOSE_FILES=(-f docker-compose.customer.yml)
if [[ "${1:-}" == "--secrets" ]]; then
  COMPOSE_FILES=(-f docker-compose.customer-secrets.yml)
  shift
fi

docker compose "${COMPOSE_FILES[@]}" pull web worker
docker compose "${COMPOSE_FILES[@]}" up -d --no-build "$@"
