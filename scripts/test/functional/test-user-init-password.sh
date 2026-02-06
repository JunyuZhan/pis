#!/bin/bash

# ============================================
# PIS 用户初始化和密码设置测试脚本
# 用途: 测试用户初始化、密码设置、登录流程
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
if [ -z "$BASE_URL" ]; then
    if curl -s --max-time 2 http://localhost:3000/api/health > /dev/null 2>&1; then
        BASE_URL="http://localhost:3000"
    elif curl -s --max-time 2 http://localhost:8081/api/health > /dev/null 2>&1; then
        BASE_URL="http://localhost:8081"
    else
        BASE_URL="http://localhost:3000"
        echo -e "${YELLOW}⚠️  未检测到运行中的服务，使用默认端口 3000${NC}"
    fi
fi

TIMEOUT=10
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

test_step() {
    local name=$1
    local command=$2
    
    ((TOTAL_TESTS++))
    echo -n "  [$TOTAL_TESTS] $name... "
    
    if eval "$command" > /tmp/user-init-test.log 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌${NC}"
        cat /tmp/user-init-test.log | head -3
        ((FAILED_TESTS++))
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 用户初始化和密码设置测试                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "基础 URL: ${CYAN}$BASE_URL${NC}"
echo ""

# ============================================
# 1. 检查管理员状态
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1️⃣  检查管理员状态${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "管理员状态检查端点存在" "curl -s --max-time $TIMEOUT '$BASE_URL/api/auth/check-admin-status' | grep -qE '(needsPasswordSetup|email)'"

admin_status=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/check-admin-status")
admin_email=$(echo "$admin_status" | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "admin@pis.com")
needs_setup=$(echo "$admin_status" | grep -o '"needsPasswordSetup":[^,}]*' | cut -d: -f2)

echo "  管理员邮箱: $admin_email"
echo "  需要设置密码: $needs_setup"

# ============================================
# 2. 检查数据库中的用户
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}2️⃣  检查数据库中的用户${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 自动检测 PostgreSQL 容器名称
if docker ps --format "{{.Names}}" | grep -q "^pis-postgres-dev$"; then
    POSTGRES_CONTAINER="pis-postgres-dev"
elif docker ps --format "{{.Names}}" | grep -q "^pis-postgres$"; then
    POSTGRES_CONTAINER="pis-postgres"
else
    POSTGRES_CONTAINER="pis-postgres-dev"
fi

test_step "数据库连接" "docker exec $POSTGRES_CONTAINER psql -U pis -d pis -c 'SELECT 1;' | grep -q '1'"

# 检查用户数量
user_count=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NULL;" | tr -d ' ')
echo "  用户总数: $user_count"

# 检查各角色用户
admin_count=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='admin' AND deleted_at IS NULL;" | tr -d ' ')
photographer_count=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='photographer' AND deleted_at IS NULL;" | tr -d ' ')
retoucher_count=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='retoucher' AND deleted_at IS NULL;" | tr -d ' ')
guest_count=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='guest' AND deleted_at IS NULL;" | tr -d ' ')

echo "  用户角色统计:"
echo "    - 管理员: $admin_count"
echo "    - 摄影师: $photographer_count"
echo "    - 修图师: $retoucher_count"
echo "    - 访客: $guest_count"

test_step "管理员账户存在" "[ $admin_count -gt 0 ]"
test_step "摄影师账户存在" "[ $photographer_count -gt 0 ]"
test_step "修图师账户存在" "[ $retoucher_count -gt 0 ]"
test_step "访客账户存在" "[ $guest_count -gt 0 ]"

# 检查密码设置状态
users_with_password=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL AND password_hash != '' AND deleted_at IS NULL;" | tr -d ' ')
users_without_password=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE (password_hash IS NULL OR password_hash = '') AND deleted_at IS NULL;" | tr -d ' ')

echo ""
echo "  密码设置状态:"
echo "    - 已设置密码: $users_with_password"
echo "    - 未设置密码: $users_without_password"

# ============================================
# 3. 测试密码设置端点
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}3️⃣  测试密码设置端点${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "密码设置端点存在" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d '{}' | grep -qE '(error|VALIDATION|Required)'"

# 测试无效请求
test_step "缺少 email 字段" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d '{\"password\":\"test123456\",\"confirmPassword\":\"test123456\"}' | grep -qE '(error|email|Required)'"

test_step "缺少 password 字段" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"confirmPassword\":\"test123456\"}' | grep -qE '(error|password|Required)'"

test_step "缺少 confirmPassword 字段" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"test123456\"}' | grep -qE '(error|confirmPassword|Required)'"

test_step "密码长度不足" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"123\",\"confirmPassword\":\"123\"}' | grep -qE '(error|至少需要|8)'"

test_step "密码不一致" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"test123456\",\"confirmPassword\":\"test123457\"}' | grep -qE '(error|不一致|confirmPassword)'"

# ============================================
# 4. 测试初始化用户脚本
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}4️⃣  测试初始化用户脚本${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "$PROJECT_DIR/scripts/utils/init-users.ts" ]; then
    test_step "初始化用户脚本存在" "test -f '$PROJECT_DIR/scripts/utils/init-users.ts'"
    
    # 检查脚本是否可执行
    if command -v tsx > /dev/null 2>&1 || command -v pnpm > /dev/null 2>&1; then
        echo "  提示: 可以使用以下命令运行初始化脚本:"
        echo "    pnpm init-users"
        echo "    或"
        echo "    pnpm exec tsx scripts/utils/init-users.ts"
    else
        echo -e "${YELLOW}  ⚠️  tsx 或 pnpm 未安装，无法测试脚本执行${NC}"
    fi
else
    echo -e "${RED}  ❌ 初始化用户脚本不存在${NC}"
    ((FAILED_TESTS++))
fi

# ============================================
# 5. 检查用户邮箱格式
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}5️⃣  检查用户邮箱格式${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 获取所有用户的邮箱
user_emails=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT email FROM users WHERE deleted_at IS NULL ORDER BY email;" | tr -d ' ')

if [ -n "$user_emails" ]; then
    echo "  用户邮箱列表:"
    echo "$user_emails" | while read -r email; do
        if [ -n "$email" ]; then
            # 检查邮箱格式
            if echo "$email" | grep -qE '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
                echo "    ✅ $email (格式正确)"
            else
                echo "    ❌ $email (格式错误)"
                ((FAILED_TESTS++))
            fi
        fi
    done
else
    echo -e "${YELLOW}  ⚠️  未找到用户${NC}"
fi

# ============================================
# 6. 检查密码哈希格式
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}6️⃣  检查密码哈希格式${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查有密码的用户的密码哈希格式
users_with_hash=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT email, password_hash FROM users WHERE password_hash IS NOT NULL AND password_hash != '' AND deleted_at IS NULL LIMIT 5;")

if [ -n "$users_with_hash" ]; then
    echo "$users_with_hash" | while IFS='|' read -r email hash; do
        email=$(echo "$email" | tr -d ' ')
        hash=$(echo "$hash" | tr -d ' ')
        if [ -n "$email" ] && [ -n "$hash" ]; then
            # 检查密码哈希格式：salt:iterations:hash
            if echo "$hash" | grep -qE '^[0-9a-fA-F]+:[0-9]+:[0-9a-fA-F]+$'; then
                echo "    ✅ $email (密码哈希格式正确)"
            else
                echo "    ❌ $email (密码哈希格式错误: $hash)"
                ((FAILED_TESTS++))
            fi
        fi
    done
else
    echo "  提示: 没有用户设置了密码"
fi

# ============================================
# 7. 测试密码设置流程（如果管理员密码未设置）
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}7️⃣  测试密码设置流程${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$needs_setup" = "true" ]; then
    echo "  管理员密码未设置，可以测试密码设置流程"
    echo "  提示: 需要实际测试密码设置，请手动操作或提供测试密码"
else
    echo "  管理员密码已设置"
    
    # 测试已设置密码的情况
    test_step "已设置密码的用户不能再次设置" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d \"{\\\"email\\\":\\\"$admin_email\\\",\\\"password\\\":\\\"test123456\\\",\\\"confirmPassword\\\":\\\"test123456\\\"}\" | grep -qE '(PASSWORD_ALREADY_SET|密码已设置)'"
fi

# ============================================
# 8. 检查潜在问题
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}8️⃣  检查潜在问题${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查是否有重复的邮箱
duplicate_emails=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT email, COUNT(*) FROM users WHERE deleted_at IS NULL GROUP BY email HAVING COUNT(*) > 1;" | tr -d ' ')

if [ -n "$duplicate_emails" ]; then
    echo -e "${RED}  ❌ 发现重复的邮箱:${NC}"
    echo "$duplicate_emails"
    ((FAILED_TESTS++))
else
    echo -e "${GREEN}  ✅ 没有重复的邮箱${NC}"
fi

# 检查是否有软删除的用户
deleted_users=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL;" | tr -d ' ')

if [ "$deleted_users" -gt 0 ]; then
    echo -e "${YELLOW}  ⚠️  发现 $deleted_users 个已删除的用户（软删除）${NC}"
else
    echo -e "${GREEN}  ✅ 没有已删除的用户${NC}"
fi

# ============================================
# 总结
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 测试结果${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "总测试数: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
