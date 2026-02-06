#!/bin/bash

# ============================================
# PIS 启动服务并运行测试脚本
# 用途: 自动启动 Docker 服务，然后运行快速验证
# 使用方法: bash scripts/test/start-and-test.sh
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
echo -e "${BLUE}║          PIS 启动服务并运行测试                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请先安装 Docker: https://www.docker.com/get-started"
    exit 1
fi

# 检查 Docker daemon 是否运行
if ! docker ps &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker daemon 未运行${NC}"
    echo ""
    echo "请先启动 Docker Desktop，然后重新运行此脚本"
    echo ""
    echo "macOS: 打开 Docker Desktop 应用"
    echo "Linux: sudo systemctl start docker"
    exit 1
fi

echo -e "${GREEN}✅ Docker 已安装并运行${NC}"
echo ""

# 检查 .env 文件
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件${NC}"
    echo "正在检查 .env.example..."
    
    if [ -f "$PROJECT_DIR/.env.example" ]; then
        echo -e "${CYAN}提示: 可以复制 .env.example 创建 .env 文件${NC}"
        echo "  cp .env.example .env"
        echo ""
        echo "或者使用一键部署脚本自动生成:"
        echo "  bash scripts/deploy/one-click-deploy.sh"
        echo ""
        read -p "是否继续启动服务？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${RED}❌ 未找到 .env.example 文件${NC}"
        exit 1
    fi
fi

# 启动 Docker 服务
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1️⃣  启动 Docker 服务${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$PROJECT_DIR/docker"

echo "正在启动服务..."
if docker compose up -d; then
    echo -e "${GREEN}✅ 服务启动成功${NC}"
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo "查看日志: docker compose logs"
    exit 1
fi

# 等待服务就绪
echo ""
echo -e "${CYAN}等待服务就绪...${NC}"
sleep 10

# 检查服务健康状态
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s --max-time 5 http://localhost:8081/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 服务已就绪${NC}"
        break
    fi
    
    attempt=$((attempt + 1))
    if [ $attempt -lt $max_attempts ]; then
        echo -n "."
        sleep 2
    fi
done

if [ $attempt -eq $max_attempts ]; then
    echo ""
    echo -e "${YELLOW}⚠️  服务启动超时，但继续运行测试...${NC}"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}2️⃣  运行快速验证${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$PROJECT_DIR"

# 运行快速验证
if bash scripts/test/core/quick-verify.sh; then
    echo ""
    echo -e "${GREEN}✅ 快速验证完成${NC}"
    echo ""
    echo "下一步:"
    echo "  - 运行完整测试: bash scripts/test/core/comprehensive-test.sh"
    echo "  - 运行 E2E 测试: pnpm test:e2e:ui"
else
    echo ""
    echo -e "${YELLOW}⚠️  快速验证有部分失败，请检查日志${NC}"
    exit 1
fi
