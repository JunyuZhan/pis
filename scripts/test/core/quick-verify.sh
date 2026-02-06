#!/bin/bash

# ============================================
# PIS 快速功能验证脚本
# 用途: 快速验证项目核心功能是否正常
# 使用方法: bash scripts/test/quick-verify.sh
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:8081}"
TIMEOUT=10
PASSED=0
FAILED=0
WARNINGS=0

test_check() {
    local name=$1
    local command=$2
    local is_warning=${3:-false}
    
    echo -n "  $name... "
    
    if eval "$command" > /tmp/quick-verify.log 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️${NC}"
            ((WARNINGS++))
        else
            echo -e "${RED}❌${NC}"
            cat /tmp/quick-verify.log | head -2
            ((FAILED++))
        fi
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 快速功能验证                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "基础 URL: ${CYAN}$BASE_URL${NC}"
echo ""

# ============================================
# 1. 服务健康检查
# ============================================
echo -e "${CYAN}1️⃣  服务健康检查${NC}"

test_check "Web 服务" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/health' | grep -q 'healthy'"
test_check "Worker 服务" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/worker/health' | grep -q 'ok'"
test_check "PostgreSQL 容器" "docker ps --filter 'name=pis-postgres' --format '{{.Names}}' | grep -q 'pis-postgres'"
test_check "Redis 容器" "docker ps --filter 'name=pis-redis' --format '{{.Names}}' | grep -q 'pis-redis'"
test_check "MinIO 容器" "docker ps --filter 'name=pis-minio' --format '{{.Names}}' | grep -q 'pis-minio'"

# ============================================
# 2. 数据库功能
# ============================================
echo ""
echo -e "${CYAN}2️⃣  数据库功能${NC}"

test_check "数据库连接" "docker exec pis-postgres psql -U pis -d pis -c 'SELECT 1;' | grep -q '1'"
test_check "用户表存在" "docker exec pis-postgres psql -U pis -d pis -c '\d users' | grep -q 'email'"
test_check "相册表存在" "docker exec pis-postgres psql -U pis -d pis -c '\d albums' | grep -q 'title'"
test_check "照片表存在" "docker exec pis-postgres psql -U pis -d pis -c '\d photos' | grep -q 'filename'"

# 检查用户初始化
user_count=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;" | tr -d ' ')
if [ "$user_count" -gt 0 ]; then
    echo -e "  ${GREEN}✅ 用户账户数量: $user_count${NC}"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠️  未找到用户账户，请运行: pnpm init-users${NC}"
    ((WARNINGS++))
fi

# ============================================
# 3. API 端点检查
# ============================================
echo ""
echo -e "${CYAN}3️⃣  API 端点检查${NC}"

test_check "健康检查端点" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/health' > /dev/null"
test_check "管理员状态端点" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/auth/check-admin-status' | grep -q 'needsPasswordSetup'"
test_check "登录端点" "curl -f -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{}' > /dev/null"
test_check "公开相册端点" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/public/albums/test' 2>&1 | grep -qE '(404|error|not found|[])'"

# ============================================
# 4. 存储功能
# ============================================
echo ""
echo -e "${CYAN}4️⃣  存储功能${NC}"

test_check "MinIO 连接" "docker exec pis-minio mc --version > /dev/null 2>&1"
test_check "存储桶存在" "docker exec pis-minio mc ls local/pis-photos > /dev/null 2>&1" true

# ============================================
# 5. Redis 功能
# ============================================
echo ""
echo -e "${CYAN}5️⃣  Redis 功能${NC}"

test_check "Redis 连接" "docker exec pis-redis redis-cli PING | grep -q 'PONG'"
test_check "Redis 键空间" "docker exec pis-redis redis-cli DBSIZE | grep -qE '^[0-9]+$'"

# ============================================
# 6. 用户初始化功能（新功能）
# ============================================
echo ""
echo -e "${CYAN}6️⃣  用户初始化功能（新功能验证）${NC}"

# 检查 init-users 脚本是否存在
if [ -f "scripts/utils/init-users.ts" ]; then
    echo -e "  ${GREEN}✅ init-users.ts 脚本存在${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ init-users.ts 脚本不存在${NC}"
    ((FAILED++))
fi

# 检查 package.json 中的 init-users 命令
if grep -q '"init-users"' package.json; then
    echo -e "  ${GREEN}✅ package.json 中包含 init-users 命令${NC}"
    ((PASSED++))
else
    echo -e "  ${RED}❌ package.json 中缺少 init-users 命令${NC}"
    ((FAILED++))
fi

# 检查数据库中是否有各角色用户
admin_count=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='admin' AND deleted_at IS NULL;" | tr -d ' ')
photographer_count=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='photographer' AND deleted_at IS NULL;" | tr -d ' ')
retoucher_count=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='retoucher' AND deleted_at IS NULL;" | tr -d ' ')
guest_count=$(docker exec pis-postgres psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='guest' AND deleted_at IS NULL;" | tr -d ' ')

echo "  用户角色统计:"
echo "    - 管理员: $admin_count"
echo "    - 摄影师: $photographer_count"
echo "    - 修图师: $retoucher_count"
echo "    - 访客: $guest_count"

if [ "$admin_count" -gt 0 ] && [ "$photographer_count" -gt 0 ] && [ "$retoucher_count" -gt 0 ] && [ "$guest_count" -gt 0 ]; then
    echo -e "  ${GREEN}✅ 所有角色用户已创建${NC}"
    ((PASSED++))
elif [ "$user_count" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠️  部分角色用户未创建，建议运行: pnpm init-users${NC}"
    ((WARNINGS++))
fi

# ============================================
# 7. 部署脚本功能（新功能验证）
# ============================================
echo ""
echo -e "${CYAN}7️⃣  部署脚本功能（新功能验证）${NC}"

# 检查 one-click-deploy.sh 是否包含 init_users 函数
if grep -q "init_users()" scripts/deploy/one-click-deploy.sh; then
    echo -e "  ${GREEN}✅ 部署脚本包含 init_users 函数${NC}"
    ((PASSED++))
else
    echo -e "  ${YELLOW}⚠️  部署脚本可能未更新${NC}"
    ((WARNINGS++))
fi

# ============================================
# 总结
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 验证结果${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
if [ $WARNINGS -gt 0 ]; then
    echo -e "警告: ${YELLOW}$WARNINGS${NC}"
fi
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ 所有核心功能正常！${NC}"
        echo ""
        echo "下一步:"
        echo "  - 运行完整测试: bash scripts/test/core/comprehensive-test.sh"
        echo "  - 运行 E2E 测试: pnpm test:e2e:ui"
        exit 0
    else
        echo -e "${YELLOW}⚠️  核心功能正常，但有 $WARNINGS 个警告${NC}"
        echo ""
        echo "建议:"
        echo "  - 检查警告项并修复"
        echo "  - 运行完整测试: bash scripts/test/core/comprehensive-test.sh"
        exit 0
    fi
else
    echo -e "${RED}❌ 有 $FAILED 个功能验证失败${NC}"
    echo ""
    echo "建议:"
    echo "  - 检查失败项并修复"
    echo "  - 查看日志: cat /tmp/quick-verify.log"
    echo "  - 检查服务状态: docker ps"
    exit 1
fi
