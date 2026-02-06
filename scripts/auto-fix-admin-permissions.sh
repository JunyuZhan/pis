#!/bin/bash

# 自动批量修复所有管理 API 权限检查
# 使用 sed 批量替换 getCurrentUser 为 requireAdmin

set -e

API_DIR="apps/web/src/app/api/admin"

echo "🔧 开始批量修复管理 API 权限检查..."

# 查找所有需要修复的文件
FILES=$(find "$API_DIR" -name "route.ts" -not -name "*.test.ts" | xargs grep -l "getCurrentUser" | grep -v "requireAdmin\|requireRole\|requireRetoucherOrAdmin" || true)

if [ -z "$FILES" ]; then
  echo "✅ 所有管理 API 已使用正确的权限检查！"
  exit 0
fi

FIXED=0
for file in $FILES; do
  echo "修复: $file"
  
  # 替换 import
  sed -i.bak "s|import { getCurrentUser } from '@/lib/auth/api-helpers'|import { requireAdmin } from '@/lib/auth/role-helpers'|g" "$file"
  
  # 替换函数调用
  sed -i.bak "s|const user = await getCurrentUser(request)|const admin = await requireAdmin(request)|g" "$file"
  
  # 替换条件检查
  sed -i.bak "s|if (!user)|if (!admin)|g" "$file"
  
  # 替换错误消息（通用模式）
  sed -i.bak "s|ApiError.unauthorized('请先登录')|ApiError.forbidden('需要管理员权限才能执行此操作')|g" "$file"
  sed -i.bak "s|'请先登录'|'需要管理员权限才能执行此操作'|g" "$file"
  
  # 删除备份文件
  rm -f "${file}.bak"
  
  FIXED=$((FIXED + 1))
done

echo ""
echo "✅ 已修复 $FIXED 个文件"
echo "⚠️  请检查修复结果，确保错误消息准确描述操作"
