#!/bin/bash

# 批量修复管理 API 权限检查脚本
# 将所有使用 getCurrentUser 的管理 API 替换为 requireAdmin

set -e

API_DIR="apps/web/src/app/api/admin"

echo "🔍 查找所有需要修复的管理 API..."

# 查找所有使用 getCurrentUser 的 route.ts 文件（排除测试文件）
FILES=$(grep -r "getCurrentUser" "$API_DIR" --include="route.ts" --exclude="*.test.ts" | cut -d: -f1 | sort -u)

if [ -z "$FILES" ]; then
  echo "✅ 所有管理 API 已使用正确的权限检查"
  exit 0
fi

echo "📝 找到以下文件需要修复:"
echo "$FILES"
echo ""

# 注意：这个脚本只用于检查，实际修复需要手动进行
# 因为每个文件的上下文不同，需要仔细处理

echo "⚠️  请手动检查并修复以下文件:"
for file in $FILES; do
  echo "  - $file"
done

echo ""
echo "修复模式："
echo "1. 将 'import { getCurrentUser } from '@/lib/auth/api-helpers' 替换为 'import { requireAdmin } from '@/lib/auth/role-helpers'"
echo "2. 将 'const user = await getCurrentUser(request)' 替换为 'const admin = await requireAdmin(request)'"
echo "3. 将 'if (!user)' 替换为 'if (!admin)'"
echo "4. 将错误消息从 '请先登录' 改为 '需要管理员权限才能...'"
