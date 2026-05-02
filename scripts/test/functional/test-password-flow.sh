#!/bin/bash

# ============================================
# PIS 密码设置和登录流程完整测试
# 用途: 测试完整的密码设置和登录流程
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
    
    if eval "$command" > /tmp/password-flow-test.log 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌${NC}"
        cat /tmp/password-flow-test.log | head -3
        ((FAILED_TESTS++))
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 密码设置和登录流程完整测试                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "基础 URL: ${CYAN}$BASE_URL${NC}"
echo ""

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-pis-postgres}"

# ============================================
# 1. 检查管理员状态
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1️⃣  检查管理员状态${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

admin_status=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/check-admin-status")
admin_email=$(echo "$admin_status" | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "admin@pis.com")
needs_setup=$(echo "$admin_status" | grep -o '"needsPasswordSetup":[^,}]*' | cut -d: -f2)

echo "  管理员邮箱: $admin_email"
echo "  需要设置密码: $needs_setup"

# ============================================
# 2. 测试未设置密码的用户尝试登录
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}2️⃣  测试未设置密码的用户尝试登录${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 查找未设置密码的用户
user_without_password=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT email FROM users WHERE (password_hash IS NULL OR password_hash = '') AND deleted_at IS NULL LIMIT 1;" | tr -d ' ')

if [ -n "$user_without_password" ]; then
    echo "  找到未设置密码的用户: $user_without_password"
    
    # 测试登录（应该返回 428 PASSWORD_NOT_SET）
    login_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$user_without_password\",\"password\":\"anypassword\"}")
    
    test_step "未设置密码的用户登录返回 428" "echo '$login_response' | grep -qE '(PASSWORD_NOT_SET|requiresPasswordSetup|首次登录)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d \"{\\\"email\\\":\\\"$user_without_password\\\",\\\"password\\\":\\\"anypassword\\\"}\") = '428' ]"
    
    # 检查响应内容
    if echo "$login_response" | grep -q "PASSWORD_NOT_SET"; then
        echo "    ✅ 正确返回 PASSWORD_NOT_SET 错误码"
    else
        echo "    ⚠️  响应: $login_response"
    fi
else
    echo "  提示: 所有用户都已设置密码，无法测试此场景"
    echo "  建议: 创建一个未设置密码的用户进行测试"
fi

# ============================================
# 3. 测试密码设置流程（针对未设置密码的用户）
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}3️⃣  测试密码设置流程${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$user_without_password" ]; then
    echo "  测试为用户 $user_without_password 设置密码"
    
    # 测试密码设置
    setup_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/setup-password" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$user_without_password\",\"password\":\"test123456\",\"confirmPassword\":\"test123456\"}")
    
    # 检查是否成功
    if echo "$setup_response" | grep -qE '(success|成功)'; then
        echo "    ✅ 密码设置成功"
        
        # 验证密码是否真的设置成功
        sleep 1
        has_password=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE email='$user_without_password' AND password_hash IS NOT NULL AND password_hash != '' AND deleted_at IS NULL;" | tr -d ' ')
        
        test_step "验证密码已设置到数据库" "[ $has_password -eq 1 ]"
        
        # 测试使用新密码登录
        sleep 1
        login_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$user_without_password\",\"password\":\"test123456\"}")
        
        # 检查登录是否成功（应该返回用户信息或 token）
        if echo "$login_response" | grep -qE '(user|token|success)'; then
            echo "    ✅ 使用新密码登录成功"
        else
            echo "    ⚠️  登录响应: $login_response"
        fi
    else
        echo "    ⚠️  密码设置响应: $setup_response"
    fi
else
    echo "  提示: 没有未设置密码的用户，跳过密码设置测试"
fi

# ============================================
# 4. 测试系统未初始化时的密码设置
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}4️⃣  测试系统未初始化时的密码设置${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查是否有管理员
admin_count=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE role='admin' AND deleted_at IS NULL;" | tr -d ' ')

if [ "$admin_count" -eq 0 ]; then
    echo "  系统未初始化（没有管理员）"
    echo "  测试创建第一个管理员..."
    
    # 测试使用不存在的邮箱设置密码（应该创建新管理员）
    test_email="newadmin@pis.com"
    setup_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/setup-password" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$test_email\",\"password\":\"test123456\",\"confirmPassword\":\"test123456\"}")
    
    if echo "$setup_response" | grep -qE '(success|创建|成功)'; then
        echo "    ✅ 成功创建第一个管理员"
        
        # 验证管理员是否创建
        new_admin=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT COUNT(*) FROM users WHERE email='$test_email' AND role='admin' AND deleted_at IS NULL;" | tr -d ' ')
        test_step "验证管理员已创建" "[ $new_admin -eq 1 ]"
    else
        echo "    ⚠️  响应: $setup_response"
    fi
else
    echo "  系统已初始化（有 $admin_count 个管理员）"
    echo "  提示: 系统未初始化场景需要手动测试（删除所有管理员后测试）"
fi

# ============================================
# 5. 测试密码设置后的登录流程
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}5️⃣  测试密码设置后的登录流程${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 获取已设置密码的管理员
admin_with_password=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT email FROM users WHERE role='admin' AND password_hash IS NOT NULL AND password_hash != '' AND deleted_at IS NULL LIMIT 1;" | tr -d ' ')

if [ -n "$admin_with_password" ]; then
    echo "  测试已设置密码的管理员: $admin_with_password"
    
    # 测试错误密码
    test_step "错误密码登录失败" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d \"{\\\"email\\\":\\\"$admin_with_password\\\",\\\"password\\\":\\\"wrongpassword\\\"}\" | grep -qE '(AUTH_ERROR|邮箱或密码错误)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d \"{\\\"email\\\":\\\"$admin_with_password\\\",\\\"password\\\":\\\"wrongpassword\\\"}\") = '401' ]"
    
    # 测试已设置密码的用户不能再次设置密码
    test_step "已设置密码的用户不能再次设置" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/setup-password' -H 'Content-Type: application/json' -d \"{\\\"email\\\":\\\"$admin_with_password\\\",\\\"password\\\":\\\"newpassword123\\\",\\\"confirmPassword\\\":\\\"newpassword123\\\"}\" | grep -qE '(PASSWORD_ALREADY_SET|密码已设置)'"
else
    echo "  提示: 没有已设置密码的管理员，无法测试此场景"
fi

# ============================================
# 6. 检查密码哈希格式一致性
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}6️⃣  检查密码哈希格式一致性${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查所有密码哈希的格式
password_hashes=$(docker exec $POSTGRES_CONTAINER psql -U pis -d pis -t -c "SELECT email, password_hash FROM users WHERE password_hash IS NOT NULL AND password_hash != '' AND deleted_at IS NULL LIMIT 10;")

if [ -n "$password_hashes" ]; then
    echo "$password_hashes" | while IFS='|' read -r email hash; do
        email=$(echo "$email" | tr -d ' ')
        hash=$(echo "$hash" | tr -d ' ')
        if [ -n "$email" ] && [ -n "$hash" ]; then
            # 检查格式：salt:iterations:hash
            parts=$(echo "$hash" | tr ':' '\n' | wc -l | tr -d ' ')
            if [ "$parts" -eq 3 ]; then
                echo "    ✅ $email (格式正确: 3 部分)"
            else
                echo "    ❌ $email (格式错误: $parts 部分)"
                ((FAILED_TESTS++))
            fi
        fi
    done
else
    echo "  提示: 没有用户设置了密码"
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
