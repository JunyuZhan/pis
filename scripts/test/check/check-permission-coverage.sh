#!/bin/bash
# ============================================
# 全站权限覆盖检查脚本
# 检查所有管理 API 和前端路由的权限保护
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

# 统计
TOTAL_APIS=0
PROTECTED_APIS=0
UNPROTECTED_APIS=0
PARTIAL_PROTECTED_APIS=0

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   🔐 全站权限覆盖检查                                      ║${NC}"
echo -e "${CYAN}║   Full Site Permission Coverage Check                    ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. 检查所有管理 API 路由
echo -e "${BOLD}1. 检查管理 API 路由权限保护${NC}"
echo ""

api_files=$(find apps/web/src/app/api/admin -name "route.ts" -type f | sort)

for api_file in $api_files; do
    TOTAL_APIS=$((TOTAL_APIS + 1))
    
    # 检查是否有权限检查
    has_require_admin=$(grep -q "requireAdmin" "$api_file" && echo "yes" || echo "no")
    has_require_role=$(grep -q "requireRole\|requireRetoucherOrAdmin" "$api_file" && echo "yes" || echo "no")
    has_get_current_user=$(grep -q "getCurrentUser" "$api_file" && echo "yes" || echo "no")
    
    # 提取路由路径
    route_path=$(echo "$api_file" | sed 's|apps/web/src/app/api/||' | sed 's|/route.ts||')
    
    if [ "$has_require_admin" = "yes" ] || [ "$has_require_role" = "yes" ]; then
        echo -e "${GREEN}✓${NC} $route_path - 有角色权限检查"
        PROTECTED_APIS=$((PROTECTED_APIS + 1))
    elif [ "$has_get_current_user" = "yes" ]; then
        echo -e "${YELLOW}⚠️  $route_path - 只检查登录状态（缺少角色检查）"
        PARTIAL_PROTECTED_APIS=$((PARTIAL_PROTECTED_APIS + 1))
    else
        echo -e "${RED}✗${NC} $route_path - 无权限检查"
        UNPROTECTED_APIS=$((UNPROTECTED_APIS + 1))
    fi
done

echo ""

# 2. 检查前端路由权限保护
echo -e "${BOLD}2. 检查前端路由权限保护${NC}"
echo ""

# 检查中间件保护
if [ -f "apps/web/src/middleware.ts" ]; then
    if grep -q "/api/admin\|/admin" apps/web/src/middleware.ts; then
        echo -e "${GREEN}✓${NC} middleware.ts 保护 /api/admin/* 和 /admin/* 路由"
    else
        echo -e "${RED}✗${NC} middleware.ts 可能缺少路由保护"
    fi
else
    echo -e "${RED}✗${NC} middleware.ts 不存在"
fi

# 检查 Admin Layout
layout_file="apps/web/src/app/admin/(dashboard)/layout.tsx"
if [ -f "$layout_file" ]; then
    if grep -q "getCurrentUser" "$layout_file"; then
        echo -e "${GREEN}✓${NC} Admin Layout 检查用户登录状态"
    else
        echo -e "${RED}✗${NC} Admin Layout 可能缺少用户检查"
    fi
else
    echo -e "${RED}✗${NC} Admin Layout 不存在"
fi

echo ""

# 3. 统计总结
echo -e "${BOLD}3. 权限覆盖统计${NC}"
echo ""

echo -e "总 API 路由数: $TOTAL_APIS"
echo -e "${GREEN}完全保护: $PROTECTED_APIS${NC} (有角色权限检查)"
echo -e "${YELLOW}部分保护: $PARTIAL_PROTECTED_APIS${NC} (只检查登录状态)"
echo -e "${RED}未保护: $UNPROTECTED_APIS${NC} (无权限检查)"
echo ""

# 计算覆盖率
if [ $TOTAL_APIS -gt 0 ]; then
    coverage=$((PROTECTED_APIS * 100 / TOTAL_APIS))
    echo -e "权限覆盖率: ${coverage}%"
else
    echo -e "权限覆盖率: 0%"
fi

echo ""

# 4. 需要修复的 API
if [ $PARTIAL_PROTECTED_APIS -gt 0 ] || [ $UNPROTECTED_APIS -gt 0 ]; then
    echo -e "${BOLD}4. 需要修复的 API${NC}"
    echo ""
    
    for api_file in $api_files; do
        has_require_admin=$(grep -q "requireAdmin" "$api_file" && echo "yes" || echo "no")
        has_require_role=$(grep -q "requireRole\|requireRetoucherOrAdmin" "$api_file" && echo "yes" || echo "no")
        has_get_current_user=$(grep -q "getCurrentUser" "$api_file" && echo "yes" || echo "no")
        
        route_path=$(echo "$api_file" | sed 's|apps/web/src/app/api/||' | sed 's|/route.ts||')
        
        if [ "$has_require_admin" = "no" ] && [ "$has_require_role" = "no" ] && [ "$has_get_current_user" = "yes" ]; then
            echo -e "${YELLOW}  - $route_path${NC} (需要添加角色检查)"
        elif [ "$has_require_admin" = "no" ] && [ "$has_require_role" = "no" ] && [ "$has_get_current_user" = "no" ]; then
            echo -e "${RED}  - $route_path${NC} (需要添加权限检查)"
        fi
    done
    
    echo ""
fi

# 5. 结论
echo -e "${BOLD}5. 结论${NC}"
echo ""

if [ $UNPROTECTED_APIS -eq 0 ] && [ $PARTIAL_PROTECTED_APIS -eq 0 ]; then
    echo -e "${GREEN}✓ 全站权限覆盖完整！${NC}"
    echo -e "  所有管理 API 都有角色权限检查"
    exit 0
elif [ $PARTIAL_PROTECTED_APIS -gt 0 ] && [ $UNPROTECTED_APIS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  权限覆盖不完整${NC}"
    echo -e "  有 $PARTIAL_PROTECTED_APIS 个 API 只检查登录状态，需要添加角色检查"
    exit 1
else
    echo -e "${RED}✗ 权限覆盖不完整${NC}"
    echo -e "  有 $UNPROTECTED_APIS 个 API 无权限检查"
    echo -e "  有 $PARTIAL_PROTECTED_APIS 个 API 只检查登录状态"
    exit 1
fi
