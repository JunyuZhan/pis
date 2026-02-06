#!/bin/bash
# ============================================
# 用户权限检查测试脚本
# 测试权限系统的完整性和一致性
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 测试计数
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   🔐 用户权限系统检查                                      ║${NC}"
echo -e "${CYAN}║   User Permissions System Check                           ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. 检查角色定义
echo -e "${BOLD}1. 检查角色定义${NC}"
echo ""

# 检查 role-helpers.ts 中的角色定义
if grep -q "admin.*photographer.*retoucher.*guest" apps/web/src/lib/auth/role-helpers.ts || \
   (grep -q "'admin'" apps/web/src/lib/auth/role-helpers.ts && \
    grep -q "'photographer'" apps/web/src/lib/auth/role-helpers.ts && \
    grep -q "'retoucher'" apps/web/src/lib/auth/role-helpers.ts && \
    grep -q "'guest'" apps/web/src/lib/auth/role-helpers.ts); then
    echo -e "${GREEN}✓${NC} role-helpers.ts 定义了所有角色 (admin, photographer, retoucher, guest)"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} role-helpers.ts 可能缺少某些角色定义"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 检查 schemas.ts 中的角色验证
if grep -q "admin.*photographer.*retoucher.*guest" apps/web/src/lib/validation/schemas.ts; then
    echo -e "${GREEN}✓${NC} schemas.ts 验证所有角色"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} schemas.ts 可能缺少某些角色验证"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 检查数据库初始化脚本中的角色定义
if grep -q "admin.*摄影师.*修图师.*访客\|admin.*photographer.*retoucher.*guest" docker/init-postgresql-db.sql; then
    echo -e "${GREEN}✓${NC} 数据库初始化脚本定义了所有角色"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${YELLOW}⚠️  数据库初始化脚本可能缺少角色注释"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 2. 检查权限检查函数
echo -e "${BOLD}2. 检查权限检查函数${NC}"
echo ""

# 检查 requireAdmin
if grep -q "requireAdmin" apps/web/src/lib/auth/role-helpers.ts; then
    echo -e "${GREEN}✓${NC} requireAdmin 函数存在"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} requireAdmin 函数不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 检查 requireRole
if grep -q "requireRole" apps/web/src/lib/auth/role-helpers.ts; then
    echo -e "${GREEN}✓${NC} requireRole 函数存在"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} requireRole 函数不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 检查 requireRetoucherOrAdmin
if grep -q "requireRetoucherOrAdmin" apps/web/src/lib/auth/role-helpers.ts; then
    echo -e "${GREEN}✓${NC} requireRetoucherOrAdmin 函数存在"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${YELLOW}⚠️  requireRetoucherOrAdmin 函数可能不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 3. 检查 API 路由权限保护
echo -e "${BOLD}3. 检查 API 路由权限保护${NC}"
echo ""

# 检查用户管理 API
admin_apis=(
    "apps/web/src/app/api/admin/users/route.ts"
    "apps/web/src/app/api/admin/users/[id]/route.ts"
    "apps/web/src/app/api/admin/users/[id]/reset-password/route.ts"
)

for api_file in "${admin_apis[@]}"; do
    if [ -f "$api_file" ]; then
        if grep -q "requireAdmin" "$api_file"; then
            echo -e "${GREEN}✓${NC} $api_file 使用 requireAdmin 保护"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            echo -e "${RED}✗${NC} $api_file 可能缺少权限检查"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    fi
done

# 检查修图任务 API
if [ -f "apps/web/src/app/api/admin/retouch/tasks/route.ts" ]; then
    if grep -q "requireRetoucherOrAdmin\|requireRole.*retoucher\|requireRole.*admin" apps/web/src/app/api/admin/retouch/tasks/route.ts; then
        echo -e "${GREEN}✓${NC} retouch/tasks API 有权限检查"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  retouch/tasks API 可能缺少权限检查"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
fi

echo ""

# 4. 检查中间件保护
echo -e "${BOLD}4. 检查中间件保护${NC}"
echo ""

if [ -f "apps/web/src/middleware.ts" ]; then
    if grep -q "/api/admin\|/admin" apps/web/src/middleware.ts; then
        echo -e "${GREEN}✓${NC} middleware.ts 保护 /api/admin 和 /admin 路由"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} middleware.ts 可能缺少路由保护"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
else
    echo -e "${RED}✗${NC} middleware.ts 不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 5. 检查权限一致性
echo -e "${BOLD}5. 检查权限一致性${NC}"
echo ""

# 检查角色定义是否一致
roles_in_helpers=$(grep -o "'admin'\|'photographer'\|'retoucher'\|'guest'" apps/web/src/lib/auth/role-helpers.ts | sort -u | wc -l)
roles_in_schemas=$(grep -o "'admin'\|'photographer'\|'retoucher'\|'guest'" apps/web/src/lib/validation/schemas.ts | sort -u | wc -l)

if [ "$roles_in_helpers" -eq 4 ] && [ "$roles_in_schemas" -eq 4 ]; then
    echo -e "${GREEN}✓${NC} 角色定义一致: 4 个角色"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${YELLOW}⚠️  角色定义可能不一致: helpers=$roles_in_helpers, schemas=$roles_in_schemas"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 6. 总结
echo -e "${BOLD}测试总结${NC}"
echo ""
echo -e "总测试数: $TEST_COUNT"
echo -e "${GREEN}通过: $PASS_COUNT${NC}"
echo -e "${RED}失败: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  发现 $FAIL_COUNT 个问题，需要检查${NC}"
    exit 1
fi
