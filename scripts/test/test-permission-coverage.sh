#!/bin/bash

# 权限覆盖率测试脚本
# 检查所有管理 API 的权限保护情况

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

API_DIR="apps/web/src/app/api/admin"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   📊 权限覆盖率检查                                        ║${NC}"
echo -e "${CYAN}║   Permission Coverage Check                               ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 统计变量
TOTAL_APIS=0
PROTECTED_APIS=0
UNPROTECTED_APIS=0
PARTIALLY_PROTECTED=0

# 查找所有 route.ts 文件（排除测试文件）
FILES=$(find "$API_DIR" -name "route.ts" -not -name "*.test.ts" | sort)

echo -e "${BOLD}检查管理 API 权限保护...${NC}"
echo ""

for file in $FILES; do
  TOTAL_APIS=$((TOTAL_APIS + 1))
  
  # 检查是否使用角色权限检查
  if grep -q "requireAdmin\|requireRole\|requireRetoucherOrAdmin" "$file"; then
    PROTECTED_APIS=$((PROTECTED_APIS + 1))
    echo -e "${GREEN}✓${NC} $(basename $(dirname $file))/$(basename $file) - 完全保护"
  # 检查是否只使用 getCurrentUser（部分保护）
  elif grep -q "getCurrentUser" "$file"; then
    PARTIALLY_PROTECTED=$((PARTIALLY_PROTECTED + 1))
    echo -e "${YELLOW}⚠️  ${NC} $(basename $(dirname $file))/$(basename $file) - 仅登录检查"
  else
    UNPROTECTED_APIS=$((UNPROTECTED_APIS + 1))
    echo -e "${RED}✗${NC} $(basename $(dirname $file))/$(basename $file) - 未保护"
  fi
done

echo ""
echo -e "${BOLD}统计结果:${NC}"
echo ""
echo -e "总 API 数量: ${CYAN}$TOTAL_APIS${NC}"
echo -e "${GREEN}完全保护 (角色检查): $PROTECTED_APIS${NC}"
echo -e "${YELLOW}部分保护 (仅登录检查): $PARTIALLY_PROTECTED${NC}"
echo -e "${RED}未保护: $UNPROTECTED_APIS${NC}"

if [ $TOTAL_APIS -gt 0 ]; then
  COVERAGE=$((PROTECTED_APIS * 100 / TOTAL_APIS))
  echo ""
  echo -e "权限覆盖率: ${CYAN}${COVERAGE}%${NC}"
fi

echo ""

# 检查前端权限控制
echo -e "${BOLD}检查前端权限控制...${NC}"
echo ""

FRONTEND_CHECKS=0
FRONTEND_PASS=0

# 检查侧边栏权限过滤
if grep -q "\.filter.*roles\|roles.*includes" "apps/web/src/components/admin/sidebar.tsx"; then
  echo -e "${GREEN}✓${NC} 侧边栏根据角色过滤菜单"
  FRONTEND_PASS=$((FRONTEND_PASS + 1))
else
  echo -e "${RED}✗${NC} 侧边栏未根据角色过滤"
fi
FRONTEND_CHECKS=$((FRONTEND_CHECKS + 1))

# 检查 useAuth hook 角色支持
if grep -q "role.*UserRole\|UserRole.*role" "apps/web/src/hooks/use-auth.ts"; then
  echo -e "${GREEN}✓${NC} useAuth hook 支持角色信息"
  FRONTEND_PASS=$((FRONTEND_PASS + 1))
else
  echo -e "${RED}✗${NC} useAuth hook 未支持角色信息"
fi
FRONTEND_CHECKS=$((FRONTEND_CHECKS + 1))

# 检查 AdminLayout 角色传递
if grep -q "getUserRole\|userWithRole" "apps/web/src/app/admin/(dashboard)/layout.tsx"; then
  echo -e "${GREEN}✓${NC} AdminLayout 获取并传递角色信息"
  FRONTEND_PASS=$((FRONTEND_PASS + 1))
else
  echo -e "${RED}✗${NC} AdminLayout 未获取角色信息"
fi
FRONTEND_CHECKS=$((FRONTEND_CHECKS + 1))

# 检查 /api/auth/me 返回角色
if grep -q "getUserRole\|role" "apps/web/src/app/api/auth/me/route.ts"; then
  echo -e "${GREEN}✓${NC} /api/auth/me 返回角色信息"
  FRONTEND_PASS=$((FRONTEND_PASS + 1))
else
  echo -e "${RED}✗${NC} /api/auth/me 未返回角色信息"
fi
FRONTEND_CHECKS=$((FRONTEND_CHECKS + 1))

echo ""
echo -e "${BOLD}前端权限控制: ${FRONTEND_PASS}/${FRONTEND_CHECKS} 通过${NC}"
echo ""

# 总结
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}总结${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ $UNPROTECTED_APIS -eq 0 ] && [ $PARTIALLY_PROTECTED -eq 0 ] && [ $FRONTEND_PASS -eq $FRONTEND_CHECKS ]; then
  echo -e "${GREEN}✅ 所有权限控制检查通过！${NC}"
  echo -e "${GREEN}   - API 层: 100% 权限保护${NC}"
  echo -e "${GREEN}   - 前端层: 完整的权限控制${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  发现以下问题:${NC}"
  if [ $UNPROTECTED_APIS -gt 0 ]; then
    echo -e "${RED}   - $UNPROTECTED_APIS 个 API 未保护${NC}"
  fi
  if [ $PARTIALLY_PROTECTED -gt 0 ]; then
    echo -e "${YELLOW}   - $PARTIALLY_PROTECTED 个 API 仅部分保护${NC}"
  fi
  if [ $FRONTEND_PASS -lt $FRONTEND_CHECKS ]; then
    echo -e "${RED}   - 前端权限控制不完整${NC}"
  fi
  exit 1
fi
