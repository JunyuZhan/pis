#!/bin/bash

# 验证所有权限控制修复是否完成

set -e

echo "🔍 验证权限控制修复..."

API_DIR="apps/web/src/app/api/admin"
ERRORS=0

# 1. 检查所有管理 API 是否使用 requireAdmin/requireRole
echo ""
echo "1️⃣  检查管理 API 权限检查..."
UNPROTECTED=$(find "$API_DIR" -name "route.ts" -not -name "*.test.ts" | xargs grep -l "getCurrentUser" | grep -v "requireAdmin\|requireRole\|requireRetoucherOrAdmin" || true)
if [ -n "$UNPROTECTED" ]; then
  echo "❌ 仍有 API 使用 getCurrentUser 而不是 requireAdmin:"
  echo "$UNPROTECTED"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ 所有管理 API 都使用正确的权限检查"
fi

# 2. 检查 /api/auth/me 是否返回角色信息
echo ""
echo "2️⃣  检查 /api/auth/me 返回角色信息..."
if grep -q "getUserRole\|role" "apps/web/src/app/api/auth/me/route.ts"; then
  echo "✅ /api/auth/me 返回角色信息"
else
  echo "❌ /api/auth/me 未返回角色信息"
  ERRORS=$((ERRORS + 1))
fi

# 3. 检查 useAuth hook 是否包含角色类型
echo ""
echo "3️⃣  检查 useAuth hook 角色支持..."
if grep -q "role.*UserRole\|UserRole.*role" "apps/web/src/hooks/use-auth.ts"; then
  echo "✅ useAuth hook 支持角色信息"
else
  echo "❌ useAuth hook 未支持角色信息"
  ERRORS=$((ERRORS + 1))
fi

# 4. 检查侧边栏是否根据角色过滤菜单
echo ""
echo "4️⃣  检查侧边栏权限控制..."
if grep -q "\.filter.*item.*roles\|roles.*includes" "apps/web/src/components/admin/sidebar.tsx"; then
  echo "✅ 侧边栏根据角色过滤菜单项"
else
  echo "❌ 侧边栏未根据角色过滤菜单项"
  ERRORS=$((ERRORS + 1))
fi

# 5. 检查 AdminLayout 是否获取并传递角色
echo ""
echo "5️⃣  检查 AdminLayout 角色传递..."
if grep -q "getUserRole\|userWithRole" "apps/web/src/app/admin/(dashboard)/layout.tsx"; then
  echo "✅ AdminLayout 获取并传递角色信息"
else
  echo "❌ AdminLayout 未获取角色信息"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "📊 验证结果:"
if [ $ERRORS -eq 0 ]; then
  echo "✅ 所有权限控制修复已完成！"
  exit 0
else
  echo "❌ 发现 $ERRORS 个问题需要修复"
  exit 1
fi
