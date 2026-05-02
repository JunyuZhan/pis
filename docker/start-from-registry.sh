#!/usr/bin/env bash
# 与直接「docker compose pull && up」等价；保留脚本名供文档与习惯用法。
# 镜像默认与 docker-compose.yml 中 PIS_WEB_IMAGE / PIS_WORKER_IMAGE 一致，可在运行前 export 覆盖。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PIS_WEB_IMAGE="${PIS_WEB_IMAGE:-hub.albertzhan.top/pis/web:latest}"
export PIS_WORKER_IMAGE="${PIS_WORKER_IMAGE:-hub.albertzhan.top/pis/worker:latest}"

if [[ -f "../.env" && ! -f ".env" ]]; then
  ln -sf ../.env .env
fi

docker compose pull
docker compose up -d "$@"
