#!/bin/bash

# 前端权限控制检查脚本

set -e

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   🎨 前端权限控制检查                                      ║${NC}"
echo -e "${CYAN}║   Frontend Permission Control Check                       ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# 1. 检查侧边栏权限控制
echo -e "${BOLD}1. 侧边栏菜单权限控制${NC}"
echo ""

if grep -q "\.filter.*roles\|roles.*includes" "apps/web/src/components/admin/sidebar.tsx"; then
  echo -e "${GREEN}✓${NC} 侧边栏根据角色过滤菜单项"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗${NC} 侧边栏未根据角色过滤"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if grep -q "roles.*admin.*retoucher\|roles.*admin" "apps/web/src/components/admin/sidebar.tsx"; then
  echo -e "${GREEN}✓${NC} 侧边栏菜单项配置了角色限制"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${YELLOW}⚠️  ${NC} 侧边栏菜单项可能缺少角色限制配置"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""

# 2. 检查 AdminLayout 角色传递
echo -e "${BOLD}2. AdminLayout 角色传递${NC}"
echo ""

if grep -q "getUserRole\|userWithRole" "apps/web/src/app/admin/(dashboard)/layout.tsx"; then
  echo -e "${GREEN}✓${NC} AdminLayout 获取并传递角色信息"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗${NC} AdminLayout 未获取角色信息"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 3. 检查 useAuth hook
echo -e "${BOLD}3. useAuth Hook${NC}"
echo ""

if grep -q "role.*UserRole\|UserRole.*role" "apps/web/src/hooks/use-auth.ts"; then
  echo -e "${GREEN}✓${NC} useAuth hook 支持角色信息"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗${NC} useAuth hook 未支持角色信息"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

if grep -q "export.*UserRole\|export.*AuthUser" "apps/web/src/hooks/use-auth.ts"; then
  echo -e "${GREEN}✓${NC} useAuth hook 导出角色类型"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${YELLOW}⚠️  ${NC} useAuth hook 可能未导出角色类型"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""

# 4. 检查 /api/auth/me 返回角色
echo -e "${BOLD}4. API 返回角色信息${NC}"
echo ""

if grep -q "getUserRole\|role" "apps/web/src/app/api/auth/me/route.ts"; then
  echo -e "${GREEN}✓${NC} /api/auth/me 返回角色信息"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${RED}✗${NC} /api/auth/me 未返回角色信息"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 5. 检查页面级权限控制
echo -e "${BOLD}5. 页面级权限控制${NC}"
echo ""

# 检查用户管理页面
if grep -q "role.*!==.*admin\|role.*===.*admin" "apps/web/src/app/admin/(dashboard)/users/page.tsx"; then
  echo -e "${GREEN}✓${NC} 用户管理页面有权限检查"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${YELLOW}⚠️  ${NC} 用户管理页面可能缺少权限检查（虽然 API 已保护）"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

# 检查设置页面
if grep -q "role.*!==.*admin\|role.*===.*admin\|getUserRole" "apps/web/src/app/admin/(dashboard)/settings/page.tsx"; then
  echo -e "${GREEN}✓${NC} 设置页面有权限检查"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${YELLOW}⚠️  ${NC} 设置页面可能缺少权限检查（虽然 API 已保护）"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

# 检查修图工作台页面
if grep -q "role.*retoucher\|role.*admin\|getUserRole" "apps/web/src/app/admin/(dashboard)/retouch/page.tsx"; then
  echo -e "${GREEN}✓${NC} 修图工作台页面有权限检查"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${YELLOW}⚠️  ${NC} 修图工作台页面可能缺少权限检查（虽然 API 已保护）"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""

# 6. 检查移动端导航
echo -e "${BOLD}6. 移动端导航权限控制${NC}"
echo ""

if grep -q "roles\|role.*filter\|role.*includes" "apps/web/src/components/admin/mobile-bottom-nav.tsx"; then
  echo -e "${GREEN}✓${NC} 移动端底部导航有权限控制"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${YELLOW}⚠️  ${NC} 移动端底部导航可能缺少权限控制"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""

# 7. 检查组件中的权限使用
echo -e "${BOLD}7. 组件中的权限使用${NC}"
echo ""

COMPONENTS_WITH_ROLE_CHECK=$(grep -r "user\.role\|role.*===" "apps/web/src/components/admin" --include="*.tsx" --include="*.ts" | wc -l | tr -d ' ')

if [ "$COMPONENTS_WITH_ROLE_CHECK" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} 找到 $COMPONENTS_WITH_ROLE_CHECK 个组件使用角色检查"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "${YELLOW}⚠️  ${NC} 未找到组件使用角色检查（虽然 API 已保护）"
  WARN_COUNT=$((WARN_COUNT + 1))
fi

echo ""

# 总结
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}总结${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "通过: ${GREEN}$PASS_COUNT${NC}"
echo -e "警告: ${YELLOW}$WARN_COUNT${NC}"
echo -e "失败: ${RED}$FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  if [ $WARN_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ 所有前端权限控制检查通过！${NC}"
    exit 0
  else
    echo -e "${YELLOW}⚠️  前端权限控制基本完成，但有 $WARN_COUNT 个可选改进${NC}"
    echo -e "${YELLOW}   注意：API 层已完全保护，前端权限控制主要是 UX 改进${NC}"
    exit 0
  fi
else
  echo -e "${RED}❌ 发现 $FAIL_COUNT 个问题需要修复${NC}"
  exit 1
fi
