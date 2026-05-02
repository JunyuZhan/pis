#!/bin/bash

# ============================================
# PIS 本地依赖启动（与部署同一套 compose）
#
# 功能：
# 1. 启动 PostgreSQL + MinIO + Redis（来自 docker-compose.yml）
# 2. 检查环境变量配置
# 3. 检查数据库初始化（必要时提示）
# 4. 提示在宿主机启动 Web / Worker（pnpm dev）
# ============================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCKER_DIR="${PROJECT_ROOT}/docker"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PIS 本地依赖启动（docker-compose.yml）${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo -e "${YELLOW}错误: Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f "${PROJECT_ROOT}/.env" ]; then
    echo -e "${YELLOW}未找到 .env 文件，正在从 .env.example 创建...${NC}"
    cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
    echo -e "${GREEN}已创建 .env 文件，请编辑后重新运行此脚本${NC}"
    exit 0
fi

cd "${DOCKER_DIR}"

# Compose 与本仓库约定：在 docker/ 下放置指向项目根 .env 的符号链接，供 env_file: .env 解析
if [ -f "${PROJECT_ROOT}/.env" ]; then
  ln -sf ../.env .env
fi

if docker compose version &> /dev/null; then
  COMPOSE=(docker compose -f docker-compose.yml)
elif command -v docker-compose &> /dev/null; then
  COMPOSE=(docker-compose -f docker-compose.yml)
else
  echo -e "${YELLOW}错误: 需要 Docker Compose V2（docker compose）或 docker-compose${NC}"
  exit 1
fi

echo -e "${BLUE}正在启动 postgres、minio、redis...${NC}"
"${COMPOSE[@]}" up -d postgres minio redis

echo -e "${BLUE}等待服务就绪...${NC}"
sleep 5

echo -e "${BLUE}服务状态：${NC}"
"${COMPOSE[@]}" ps postgres minio redis

echo -e "${BLUE}检查数据库初始化状态...${NC}"
DB_INIT_CHECK=$(docker exec pis-postgres psql -U pis -d pis -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'albums');" 2>/dev/null || echo "false")

if [ "$DB_INIT_CHECK" != "t" ]; then
    echo -e "${YELLOW}数据库未初始化，正在尝试执行初始化 SQL...${NC}"
    docker exec pis-postgres psql -U pis -d pis -f /docker-entrypoint-initdb.d/init-postgresql-db.sql || {
        echo -e "${YELLOW}自动初始化失败，请手动执行:${NC}"
        echo "docker exec -i pis-postgres psql -U pis -d pis < ${DOCKER_DIR}/init-postgresql-db.sql"
    }
else
    echo -e "${GREEN}数据库已初始化${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}基础依赖已启动${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}宿主机连接（.env 中请使用 localhost）：${NC}"
echo -e "  PostgreSQL: localhost:5432"
echo -e "  MinIO API:  http://localhost:9000"
echo -e "  MinIO Console: http://localhost:9001"
echo -e "  Redis:      localhost:6379"
echo ""
echo -e "${BLUE}下一步：${NC}"
echo -e "  1. 在终端 1 启动 Web:     ${YELLOW}pnpm dev${NC}"
echo -e "  2. 在终端 2 启动 Worker:  ${YELLOW}cd services/worker && pnpm dev${NC}"
echo ""
echo -e "${BLUE}停止仅依赖容器：${NC}"
echo -e "  ${YELLOW}cd docker && docker compose -f docker-compose.yml stop postgres redis minio${NC}"
echo ""
