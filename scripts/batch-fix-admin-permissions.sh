#!/bin/bash

# 批量修复所有管理 API 权限检查
# 将所有使用 getCurrentUser 的管理 API 替换为 requireAdmin

set -e

API_DIR="apps/web/src/app/api/admin"

echo "🔍 查找所有需要修复的管理 API..."

# 查找所有 route.ts 文件（排除测试文件）
FILES=$(find "$API_DIR" -name "route.ts" -not -name "*.test.ts" | sort)

FIXED_COUNT=0
TOTAL_COUNT=0

for file in $FILES; do
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  
  # 检查是否使用 getCurrentUser
  if grep -q "getCurrentUser" "$file" && ! grep -q "requireAdmin\|requireRole\|requireRetoucherOrAdmin" "$file"; then
    echo "⚠️  需要修复: $file"
    FIXED_COUNT=$((FIXED_COUNT + 1))
  fi
done

echo ""
echo "📊 统计:"
echo "  总文件数: $TOTAL_COUNT"
echo "  需要修复: $FIXED_COUNT"
echo "  已修复: $((TOTAL_COUNT - FIXED_COUNT))"

if [ $FIXED_COUNT -eq 0 ]; then
  echo ""
  echo "✅ 所有管理 API 已使用正确的权限检查！"
  exit 0
else
  echo ""
  echo "❌ 仍有 $FIXED_COUNT 个文件需要修复"
  exit 1
fi
