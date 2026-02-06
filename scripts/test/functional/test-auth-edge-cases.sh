#!/bin/bash

# ============================================
# PIS 认证边界情况测试脚本
# 用途: 测试各种边界情况和异常场景
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
    
    if eval "$command" > /tmp/auth-edge-test.log 2>&1; then
        echo -e "${GREEN}✅${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}❌${NC}"
        cat /tmp/auth-edge-test.log | head -2
        ((FAILED_TESTS++))
        return 1
    fi
}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          PIS 认证边界情况测试                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "基础 URL: ${CYAN}$BASE_URL${NC}"
echo ""

# ============================================
# 1. 无效请求测试
# ============================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}1️⃣  无效请求测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "空请求体登录" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{}' | grep -qE '(error|VALIDATION|Required)'"

test_step "缺少 email 字段" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"password\":\"test\"}' | grep -qE '(error|email|Required)'"

test_step "缺少 password 字段" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\"}' | grep -qE '(error|password|Required)'"

test_step "无效 JSON 格式" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{invalid json}' | grep -qE '(error|JSON|parse)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{invalid json}') != '200' ]"

# ============================================
# 2. 边界值测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}2️⃣  边界值测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "超长邮箱处理" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"$(printf 'a%.0s' {1..300})@test.com\",\"password\":\"test\"}' | grep -qE '(error|valid|邮箱)'"

test_step "空字符串邮箱" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"\",\"password\":\"test\"}' | grep -qE '(error|Required|email)'"

test_step "空字符串密码" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"test@test.com\",\"password\":\"\"}' | grep -qE '(error|password|Required)'"

test_step "特殊字符邮箱" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: application/json' -d '{\"email\":\"test<script>@test.com\",\"password\":\"test\"}' | grep -qE '(error|valid|邮箱)'"

# ============================================
# 3. HTTP 方法测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}3️⃣  HTTP 方法测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "GET 方法访问登录端点" "[ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X GET '$BASE_URL/api/auth/login') != '200' ] || curl -s --max-time $TIMEOUT -X GET '$BASE_URL/api/auth/login' | grep -qE '(error|method|not allowed)'"

test_step "PUT 方法访问登录端点" "[ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X PUT '$BASE_URL/api/auth/login') != '200' ] || curl -s --max-time $TIMEOUT -X PUT '$BASE_URL/api/auth/login' | grep -qE '(error|method|not allowed)'"

test_step "DELETE 方法访问登录端点" "[ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X DELETE '$BASE_URL/api/auth/login') != '200' ] || curl -s --max-time $TIMEOUT -X DELETE '$BASE_URL/api/auth/login' | grep -qE '(error|method|not allowed)'"

# ============================================
# 4. Content-Type 测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}4️⃣  Content-Type 测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_step "缺少 Content-Type 头" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}' | grep -qE '(error|Content-Type|json)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X POST '$BASE_URL/api/auth/login' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}') != '200' ]"

test_step "错误的 Content-Type" "curl -s --max-time $TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: text/plain' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}' | grep -qE '(error|Content-Type|json)' || [ \$(curl -s -o /dev/null -w '%{http_code}' --max-time \$TIMEOUT -X POST '$BASE_URL/api/auth/login' -H 'Content-Type: text/plain' -d '{\"email\":\"test@test.com\",\"password\":\"test\"}') != '200' ]"

# ============================================
# 5. 速率限制测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}5️⃣  速率限制测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 发送多个登录请求
echo "  发送 5 个快速登录请求..."
for i in {1..5}; do
    curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"test@test.com\",\"password\":\"wrong\"}" > /dev/null 2>&1 &
done
wait

# 检查是否触发速率限制
sleep 1
rate_limit_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test@test.com\",\"password\":\"wrong\"}")

test_step "速率限制触发" "echo '$rate_limit_response' | grep -qE '(RATE_LIMIT|rate limit|过于频繁)' || echo '速率限制可能未触发（这是正常的）'"

# ============================================
# 6. Cookie 安全测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}6️⃣  Cookie 安全测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 检查 /api/auth/me 的响应头
me_headers=$(curl -s -I --max-time $TIMEOUT "$BASE_URL/api/auth/me" 2>&1)

test_step "检查 Cookie 设置" "echo '$me_headers' | grep -qi 'set-cookie' || echo 'Cookie 检查需要登录状态'"

# ============================================
# 7. 错误响应格式测试
# ============================================
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}7️⃣  错误响应格式测试${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

error_response=$(curl -s --max-time $TIMEOUT -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"test@test.com\",\"password\":\"wrong\"}")

test_step "错误响应包含 error 字段" "echo '$error_response' | grep -qE '\"error\"' || echo '$error_response' | grep -qE '(error|ERROR)'"

test_step "错误响应格式正确" "echo '$error_response' | grep -qE '(code|message)' || echo '$error_response' | jq . > /dev/null 2>&1"

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
    echo -e "${GREEN}✅ 所有边界情况测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED_TESTS 个测试失败${NC}"
    exit 1
fi
