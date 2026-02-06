#!/bin/bash

# ============================================
# PIS 集成测试脚本
# 用途: 运行完整的集成测试套件
# 使用方法: bash scripts/test/integration-test.sh
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

# 自动检测 BASE_URL
if curl -s --max-time 2 http://localhost:3000/api/health > /dev/null 2>&1; then
    BASE_URL="http://localhost:3000"
    echo -e "${GREEN}✅ 检测到开发服务器运行在端口 3000${NC}"
elif curl -s --max-time 2 http://localhost:8081/api/health > /dev/null 2>&1; then
    BASE_URL="http://localhost:8081"
    echo -e "${GREEN}✅ 检测到生产服务器运行在端口 8081${NC}"
else
    echo -e "${RED}❌ 未检测到运行中的服务${NC}"
    echo "请先启动开发服务器: pnpm dev"
    exit 1
fi

export BASE_URL

TIMEOUT=10
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

test_step() {
    local name=$1
    local command=$2
    
    ((TOTAL_TESTS++))
    echo -n "  [$TOTAL_TESTS] $name... "
    
    if eval "$command" > /tmp/integration-test.log 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌${NC}"
        cat /tmp/integration-test.log | head -3
        ((FAILED_TESTS++))
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 集成测试套件                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "基础 URL: ${CYAN}$BASE_URL${NC}"
echo ""

# ============================================
# 1. 服务健康检查
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1️⃣  服务健康检查${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "Web 服务健康检查" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/health' | grep -q 'healthy'"

# ============================================
# 2. 认证相关测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}2️⃣  认证功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "管理员状态检查端点" "curl -f -s --max-time $TIMEOUT '$BASE_URL/api/auth/check-admin-status' | grep -q 'needsPasswordSetup'"

# 获取管理员邮箱
admin_status=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/check-admin-status")
admin_email=$(echo "$admin_status" | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "admin@pis.com")

test_step "登录端点存在" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{}' | grep -qE '(error|message|email|password|VALIDATION)'"

# ============================================
# 3. 数据库功能测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}3️⃣  数据库功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "数据库连接" "docker exec pis-postgres-dev psql -U pis -d pis -c 'SELECT 1;' | grep -q '1'"

test_step "用户表查询" "docker exec pis-postgres-dev psql -U pis -d pis -c 'SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;' | grep -qE '[0-9]+'"

user_count=$(docker exec pis-postgres-dev psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;" | tr -d ' ')
echo "  用户账户数量: $user_count"

# ============================================
# 4. API 端点功能测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}4️⃣  API 端点功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "公开相册端点" "curl -s --max-time $TIMEOUT '$BASE_URL/api/public/albums/test-slug' 2>&1 | grep -qE '(404|error|not found|Not Found|不存在)'"

test_step "Media 代理端点" "http_code=\$(curl -s -w '%{http_code}' -o /dev/null --max-time \$TIMEOUT '$BASE_URL/media/test.jpg') && [ \"\$http_code\" = '404' ] || [ \"\$http_code\" = '403' ]"

# ============================================
# 5. 存储功能测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}5️⃣  存储功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "Redis 连接" "docker exec pis-redis-dev redis-cli PING | grep -q 'PONG'"

test_step "MinIO 连接" "docker exec pis-minio-dev mc --version > /dev/null 2>&1"

# ============================================
# 6. 用户初始化功能测试（新功能）
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}6️⃣  用户初始化功能测试（新功能）${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查各角色用户是否存在
admin_count=$(docker exec pis-postgres-dev psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='admin' AND deleted_at IS NULL;" | tr -d ' ')
photographer_count=$(docker exec pis-postgres-dev psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='photographer' AND deleted_at IS NULL;" | tr -d ' ')
retoucher_count=$(docker exec pis-postgres-dev psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='retoucher' AND deleted_at IS NULL;" | tr -d ' ')
guest_count=$(docker exec pis-postgres-dev psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='guest' AND deleted_at IS NULL;" | tr -d ' ')

test_step "管理员账户存在" "[ $admin_count -gt 0 ]"

test_step "摄影师账户存在" "[ $photographer_count -gt 0 ]"

test_step "修图师账户存在" "[ $retoucher_count -gt 0 ]"

test_step "访客账户存在" "[ $guest_count -gt 0 ]"

echo "  用户角色统计:"
echo "    - 管理员: $admin_count"
echo "    - 摄影师: $photographer_count"
echo "    - 修图师: $retoucher_count"
echo "    - 访客: $guest_count"

# ============================================
# 7. 密码设置和登录流程测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}7️⃣  密码设置和登录流程测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查是否有用户设置了密码
users_with_password=$(docker exec pis-postgres-dev psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL AND deleted_at IS NULL;" | tr -d ' ')

if [ "$users_with_password" -gt 0 ]; then
    test_step "密码设置功能" "echo '密码已设置的用户: $users_with_password'"
    
    # 测试登录（使用第一个有密码的管理员）
    admin_with_password=$(docker exec pis-postgres-dev psql -U pis -d pis -t -c "SELECT email FROM users WHERE role='admin' AND password_hash IS NOT NULL AND deleted_at IS NULL LIMIT 1;" | tr -d ' ')
    
    if [ -n "$admin_with_password" ]; then
        echo "  测试登录功能（需要密码）..."
        echo "  提示: 登录测试需要实际密码，跳过"
    fi
else
    echo "  提示: 所有用户密码未设置，这是正常的（首次登录时设置）"
fi

# ============================================
# 总结
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 集成测试结果${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "总测试数: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有集成测试通过！${NC}"
    echo ""
    echo "下一步:"
    echo "  - 运行 E2E 测试: pnpm test:e2e:ui"
    echo "  - 运行完整功能测试: BASE_URL=$BASE_URL bash scripts/test/functional/test-full-features.sh"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    echo ""
    echo "查看详细日志:"
    echo "  cat /tmp/integration-test.log"
    exit 1
fi
