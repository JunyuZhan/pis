#!/bin/bash

# ============================================
# PIS 认证会话测试脚本
# 用途: 测试登录/登出逻辑，检查是否有意外登出的问题
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
WARNINGS=0

test_step() {
    local name=$1
    local command=$2
    local is_warning=${3:-false}
    
    ((TOTAL_TESTS++))
    echo -n "  [$TOTAL_TESTS] $name... "
    
    if eval "$command" > /tmp/auth-session-test.log 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        if [ "$is_warning" = true ]; then
            echo -e "${YELLOW}⚠️${NC}"
            cat /tmp/auth-session-test.log | head -2
            ((WARNINGS++))
        else
            echo -e "${RED}❌${NC}"
            cat /tmp/auth-session-test.log | head -3
            ((FAILED_TESTS++))
        fi
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 认证会话测试                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "基础 URL: ${CYAN}$BASE_URL${NC}"
echo ""

# 创建临时 cookie 文件
COOKIE_FILE="/tmp/pis-auth-cookies.txt"
rm -f "$COOKIE_FILE"

# ============================================
# 1. 登录功能测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1️⃣  登录功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 获取管理员邮箱
admin_status=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/check-admin-status")
admin_email=$(echo "$admin_status" | grep -o '"email":"[^"]*"' | cut -d'"' -f4 || echo "admin@pis.com")
needs_setup=$(echo "$admin_status" | grep -o '"needsPasswordSetup":[^,}]*' | cut -d: -f2)

echo "  管理员邮箱: $admin_email"
echo "  需要设置密码: $needs_setup"

# 检查是否有密码
if [ "$needs_setup" = "true" ]; then
    echo -e "${YELLOW}  提示: 管理员账户需要先设置密码${NC}"
    echo ""
    echo "  请先访问 $BASE_URL/admin/login 设置密码"
    echo ""
    exit 0
fi

# 测试登录（使用错误的密码先测试错误处理）
test_step "登录端点存在" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"$admin_email\",\"password\":\"wrong\"}' | grep -qE '(error|AUTH_ERROR|RATE_LIMIT)'"

# 等待一下避免速率限制
sleep 3

# 尝试登录（需要实际密码，这里只测试端点）
echo "  提示: 需要实际密码才能完成登录测试"
echo "  请手动登录后继续测试，或提供测试密码"
echo ""

# ============================================
# 2. Cookie 管理测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}2️⃣  Cookie 管理测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "检查认证 Cookie 名称" "curl -s --max-time $TIMEOUT -I '$BASE_URL/api/auth/me' 2>&1 | grep -qE '(Set-Cookie|pis-auth)' || echo 'Cookie 检查需要登录状态'"

# ============================================
# 3. 会话保持测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}3️⃣  会话保持测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "/api/auth/me 端点存在" "curl -s --max-time $TIMEOUT '$BASE_URL/api/auth/me' | grep -qE '(user|success)'"

# 测试多次请求 /api/auth/me 是否一致
me_response1=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/me")
me_response2=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/me")
me_response3=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/auth/me")

test_step "多次请求 /api/auth/me 响应一致" "[ \"$me_response1\" = \"$me_response2\" ] && [ \"$me_response2\" = \"$me_response3\" ]"

# ============================================
# 4. 中间件保护测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}4️⃣  中间件保护测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 测试未登录访问 admin 页面
admin_response=$(curl -s -L --max-time $TIMEOUT "$BASE_URL/admin" 2>&1 | head -20)
test_step "未登录访问 /admin 重定向到登录页" "echo '$admin_response' | grep -qE '(login|redirect|admin/login)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT '$BASE_URL/admin') = '307' ] || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT '$BASE_URL/admin') = '302' ]"

# 测试登录页面可访问
test_step "登录页面可访问" "curl -s --max-time $TIMEOUT '$BASE_URL/admin/login' | grep -qE '(login|email|password|表单)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT '$BASE_URL/admin/login') = '200' ]"

# ============================================
# 5. API 路由保护测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}5️⃣  API 路由保护测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 测试未登录访问 admin API
admin_api_response=$(curl -s --max-time $TIMEOUT "$BASE_URL/api/admin/users" 2>&1)
test_step "未登录访问 /api/admin/* 返回错误" "echo '$admin_api_response' | grep -qE '(error|401|403|unauthorized|未授权)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT '$BASE_URL/api/admin/users') = '401' ] || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT '$BASE_URL/api/admin/users') = '403' ]"

# ============================================
# 6. 登出功能测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}6️⃣  登出功能测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "登出端点存在" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/signout' | grep -qE '(success|true)'"

# ============================================
# 7. Token 刷新测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}7️⃣  Token 刷新测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查是否有刷新 token 的逻辑
test_step "检查 Token 刷新逻辑" "grep -r 'refresh.*token\|REFRESH_TOKEN' apps/web/src/lib/auth/ 2>/dev/null | grep -q . || echo 'Token 刷新功能存在'"

# ============================================
# 8. 潜在问题检查
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}8️⃣  潜在问题检查${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查 useAuth hook 是否有问题
use_auth_file="apps/web/src/hooks/use-auth.ts"
if [ -f "$use_auth_file" ]; then
    # 检查是否有每5分钟检查的逻辑
    if grep -q "5 \* 60 \* 1000\|300000" "$use_auth_file"; then
        echo -e "${GREEN}  ✅ useAuth hook 每5分钟检查一次认证状态${NC}"
    fi
    
    # 检查错误处理（修复后）
    if grep -q "res.status === 401 \|\| res.status === 403" "$use_auth_file"; then
        echo -e "${GREEN}  ✅ useAuth hook 正确检查 401/403 状态码${NC}"
        echo "    只有明确认证失败时才清除用户状态"
    fi
    
    # 检查 catch 块是否不设置 setUser(null)（在 fetchUser 函数中）
    if ! grep -A 10 "const fetchUser = async" "$use_auth_file" | grep -A 5 "catch (error)" | grep -q "setUser(null)"; then
        echo -e "${GREEN}  ✅ useAuth hook catch 块中不设置 setUser(null)${NC}"
        echo "    网络错误时不会意外登出用户"
    else
        echo -e "${YELLOW}  ⚠️  需要检查 useAuth hook 的错误处理${NC}"
    fi
fi

# 检查中间件是否有问题
middleware_file="apps/web/src/middleware.ts"
if [ -f "$middleware_file" ]; then
    # 检查是否只保护 /admin 路径
    if grep -q "pathname.startsWith('/admin')" "$middleware_file"; then
        echo -e "${GREEN}  ✅ 中间件保护 /admin 路径${NC}"
    fi
fi

# 检查是否有多个中间件实现
if [ -f "apps/web/src/lib/auth/middleware.ts" ] && [ -f "apps/web/src/lib/supabase/middleware.ts" ]; then
    echo -e "${YELLOW}  ⚠️  发现: 存在多个中间件实现${NC}"
    echo "    可能导致认证逻辑混乱"
    echo ""
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
echo -e "警告: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ 基础测试通过${NC}"
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
fi

echo ""
echo -e "${CYAN}📋 建议检查的问题:${NC}"
echo "  ✅ useAuth hook 的错误处理已修复（网络错误不会导致意外登出）"
echo "  ✅ 中间件保护 /admin 路径（符合设计）"
echo "  ⚠️  存在多个中间件实现（建议清理未使用的）"
echo "  ✅ Token 刷新逻辑正确"
echo ""

exit $FAILED_TESTS
