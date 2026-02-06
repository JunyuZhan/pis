#!/bin/bash

# ============================================
# PIS 本地开发模式测试脚本
# 用途: 快速启动本地开发环境并运行测试（无需等待 Docker 构建）
# 使用方法: bash scripts/test/local-test.sh
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 本地开发模式测试                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo -e "${RED}❌ Docker daemon 未运行${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Docker 已安装并运行${NC}"
echo ""

# 步骤 1: 启动基础服务（PostgreSQL, Redis, MinIO）
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1️⃣  启动基础服务（PostgreSQL, Redis, MinIO）${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$PROJECT_DIR"

# 检查是否已有基础服务运行
if docker ps --filter "name=pis-postgres" --format "{{.Names}}" | grep -q "pis-postgres"; then
    echo -e "${GREEN}✅ 基础服务已在运行${NC}"
else
    echo "正在启动基础服务..."
    
    # 使用开发环境配置启动基础服务
    if [ -f "docker/docker-compose.dev.yml" ]; then
        cd docker
        if docker compose -f docker-compose.dev.yml up -d postgres redis minio; then
            echo -e "${GREEN}✅ 基础服务启动成功${NC}"
        else
            echo -e "${RED}❌ 基础服务启动失败${NC}"
            exit 1
        fi
        cd ..
    else
        # 如果没有 dev 配置，只启动基础服务容器
        cd docker
        if docker compose up -d postgres redis minio; then
            echo -e "${GREEN}✅ 基础服务启动成功${NC}"
        else
            echo -e "${RED}❌ 基础服务启动失败${NC}"
            exit 1
        fi
        cd ..
    fi
    
    # 等待服务就绪
    echo "等待服务就绪..."
    sleep 5
fi

# 步骤 2: 检查环境变量配置
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}2️⃣  检查环境变量配置${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件${NC}"
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        echo "正在从 .env.example 创建 .env..."
        cp .env.example .env
        echo -e "${GREEN}✅ 已创建 .env 文件，请检查配置${NC}"
    else
        echo -e "${RED}❌ 未找到 .env.example 文件${NC}"
        exit 1
    fi
fi

# 检查关键配置
if grep -q "DATABASE_HOST=localhost" "$PROJECT_DIR/.env" || grep -q "DATABASE_HOST=postgres" "$PROJECT_DIR/.env"; then
    echo -e "${GREEN}✅ 数据库配置已设置${NC}"
else
    echo -e "${YELLOW}⚠️  请确保 .env 中 DATABASE_HOST 设置为 localhost 或 postgres${NC}"
fi

# 步骤 3: 运行不需要完整服务的测试
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}3️⃣  运行本地测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}提示: 本地开发模式测试使用端口 3000${NC}"
echo ""

# 检查开发服务器是否运行
if curl -s --max-time 2 http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 开发服务器已在运行 (端口 3000)${NC}"
    echo ""
    echo "可以运行以下测试:"
    echo "  - pnpm test:e2e:ui (E2E 测试，可视化)"
    echo "  - BASE_URL=http://localhost:3000 bash scripts/test/functional/test-business-logic.sh"
else
    echo -e "${YELLOW}⚠️  开发服务器未运行${NC}"
    echo ""
    echo "请先启动开发服务器:"
    echo "  终端 1: pnpm dev"
    echo ""
    echo "然后在新终端运行测试:"
    echo "  - pnpm test:e2e:ui"
    echo "  - BASE_URL=http://localhost:3000 bash scripts/test/functional/test-business-logic.sh"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📋 本地测试选项${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "1. 代码检查（不需要服务）:"
echo "   pnpm lint"
echo ""

echo "2. 组件测试（不需要服务）:"
echo "   pnpm test:components"
echo ""

echo "3. E2E 测试（需要开发服务器运行在 3000 端口）:"
echo "   pnpm test:e2e:ui"
echo ""

echo "4. 业务逻辑测试（需要开发服务器）:"
echo "   BASE_URL=http://localhost:3000 bash scripts/test/functional/test-business-logic.sh"
echo ""

echo "5. API 端点测试（需要开发服务器）:"
echo "   BASE_URL=http://localhost:3000 bash scripts/test/functional/test-api-endpoints.sh"
echo ""

echo -e "${GREEN}✅ 本地测试环境准备完成！${NC}"
echo ""
echo "下一步:"
echo "  1. 启动开发服务器: pnpm dev"
echo "  2. 运行测试: pnpm test:e2e:ui"
