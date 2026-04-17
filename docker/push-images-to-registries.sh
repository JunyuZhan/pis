#!/usr/bin/env bash
# 在仓库根目录构建 web / worker，并推送到一个或多个 Registry（默认含私有仓库路径；
# 可选再打上 Docker Hub 等第二套仓库名，同一镜像 digest 多标签推送）。
#
# 用法（在仓库根目录）:
#   export PIS_IMAGE_TAG=1.2.0
#   export PIS_DOCKERHUB_WEB_IMAGE=docker.io/<DockerHub用户名>/pis-web
#   export PIS_DOCKERHUB_WORKER_IMAGE=docker.io/<DockerHub用户名>/pis-worker
#   bash docker/push-images-to-registries.sh
#
#   # 或仅传版本号:
#   bash docker/push-images-to-registries.sh 1.2.0
#
# 环境变量（均可选，缺省与 docker-compose.registry.yml 一致）:
#   PIS_IMAGE_TAG                 镜像标签（必填：环境变量或第一个参数）
#   PIS_PRIVATE_WEB_IMAGE         默认 hub.albertzhan.top/pis/web（不含 tag）
#   PIS_PRIVATE_WORKER_IMAGE      默认 hub.albertzhan.top/pis/worker（不含 tag）
#   PIS_DOCKERHUB_WEB_IMAGE       若设置，则额外 -t 并 push 该仓库（不含 tag）
#   PIS_DOCKERHUB_WORKER_IMAGE    若设置，则额外 -t 并 push 该仓库（不含 tag）
#
# 推送前请在目标 Registry 执行 docker login（私有域与 Docker Hub 需分别登录）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PIS_IMAGE_TAG="${PIS_IMAGE_TAG:-${1:-}}"
if [[ -z "${PIS_IMAGE_TAG}" ]]; then
  echo "用法: PIS_IMAGE_TAG=1.2.0 bash docker/push-images-to-registries.sh" >&2
  echo "  或: bash docker/push-images-to-registries.sh 1.2.0" >&2
  exit 1
fi

PRIVATE_WEB="${PIS_PRIVATE_WEB_IMAGE:-hub.albertzhan.top/pis/web}"
PRIVATE_WORKER="${PIS_PRIVATE_WORKER_IMAGE:-hub.albertzhan.top/pis/worker}"
HUB_WEB="${PIS_DOCKERHUB_WEB_IMAGE:-}"
HUB_WORKER="${PIS_DOCKERHUB_WORKER_IMAGE:-}"

web_extra=""
if [[ -n "${HUB_WEB}" ]]; then
  web_extra=" + ${HUB_WEB}:${PIS_IMAGE_TAG}"
fi
echo "==> Build web -> ${PRIVATE_WEB}:${PIS_IMAGE_TAG}${web_extra}"
web_args=(-f docker/web.Dockerfile -t "${PRIVATE_WEB}:${PIS_IMAGE_TAG}")
if [[ -n "${HUB_WEB}" ]]; then
  web_args+=(-t "${HUB_WEB}:${PIS_IMAGE_TAG}")
fi
docker build "${web_args[@]}" .

worker_extra=""
if [[ -n "${HUB_WORKER}" ]]; then
  worker_extra=" + ${HUB_WORKER}:${PIS_IMAGE_TAG}"
fi
echo "==> Build worker -> ${PRIVATE_WORKER}:${PIS_IMAGE_TAG}${worker_extra}"
worker_args=(-f docker/worker.Dockerfile -t "${PRIVATE_WORKER}:${PIS_IMAGE_TAG}")
if [[ -n "${HUB_WORKER}" ]]; then
  worker_args+=(-t "${HUB_WORKER}:${PIS_IMAGE_TAG}")
fi
docker build "${worker_args[@]}" .

echo "==> Push ${PRIVATE_WEB}:${PIS_IMAGE_TAG}"
docker push "${PRIVATE_WEB}:${PIS_IMAGE_TAG}"
echo "==> Push ${PRIVATE_WORKER}:${PIS_IMAGE_TAG}"
docker push "${PRIVATE_WORKER}:${PIS_IMAGE_TAG}"

if [[ -n "${HUB_WEB}" ]]; then
  echo "==> Push ${HUB_WEB}:${PIS_IMAGE_TAG}"
  docker push "${HUB_WEB}:${PIS_IMAGE_TAG}"
fi
if [[ -n "${HUB_WORKER}" ]]; then
  echo "==> Push ${HUB_WORKER}:${PIS_IMAGE_TAG}"
  docker push "${HUB_WORKER}:${PIS_IMAGE_TAG}"
fi

echo "==> Done. 运行环境在 .env 中只配置一套 PIS_WEB_IMAGE / PIS_WORKER_IMAGE 指向实际拉取的 Registry。"
