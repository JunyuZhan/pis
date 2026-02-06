#!/bin/bash

# ============================================
# PIS 测试状态检查脚本
# 用途: 检查测试环境状态，提供测试建议
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 测试环境状态检查                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查 Docker
echo -e "${CYAN}1️⃣  Docker 状态${NC}"
if command -v docker &> /dev/null; then
    if docker ps &> /dev/null; then
        echo -e "  ${GREEN}✅ Docker daemon 运行中${NC}"
        
        # 检查容器
        containers=$(docker ps --filter "name=pis-" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$containers" -gt 0 ]; then
            echo -e "  ${GREEN}✅ 运行中的容器: $containers${NC}"
            docker ps --filter "name=pis-" --format "  - {{.Names}}: {{.Status}}" 2>/dev/null
        else
            echo -e "  ${YELLOW}⚠️  没有运行中的 PIS 容器${NC}"
        fi
    else
        echo -e "  ${RED}❌ Docker daemon 未运行${NC}"
    fi
else
    echo -e "  ${RED}❌ Docker 未安装${NC}"
fi

echo ""

# 检查服务健康
echo -e "${CYAN}2️⃣  服务健康检查${NC}"
if curl -s --max-time 3 http://localhost:8081/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Web 服务 (8081) 运行正常${NC}"
elif curl -s --max-time 3 http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ Web 服务 (3000) 运行正常${NC}"
else
    echo -e "  ${YELLOW}⚠️  Web 服务未运行${NC}"
fi

echo ""

# 检查数据库
echo -e "${CYAN}3️⃣  数据库连接${NC}"
if docker exec pis-postgres psql -U pis -d pis -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ PostgreSQL 连接正常${NC}"
else
    echo -e "  ${YELLOW}⚠️  PostgreSQL 未连接或未运行${NC}"
fi

echo ""

# 测试建议
echo -e "${CYAN}4️⃣  测试建议${NC}"
echo ""

# 检查是否可以运行快速验证
if docker ps --filter "name=pis-postgres" --format "{{.Names}}" | grep -q "pis-postgres" && \
   curl -s --max-time 3 http://localhost:8081/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ 可以运行完整测试:${NC}"
    echo "    - pnpm test:quick"
    echo "    - bash scripts/test/core/comprehensive-test.sh"
else
    echo -e "  ${YELLOW}⚠️  当前可以运行的测试:${NC}"
    echo "    - pnpm lint (代码检查)"
    echo "    - cd apps/web && pnpm exec tsc --noEmit (类型检查)"
    echo ""
    echo -e "  ${CYAN}等待 Docker 构建完成后可以运行:${NC}"
    echo "    - pnpm test:quick"
    echo "    - bash scripts/test/functional/test-business-logic.sh"
fi

echo ""
