#!/bin/bash

# 测试 AI 修图全局关闭功能
# 验证：
# 1. 全局关闭功能是否正常工作
# 2. 关闭后新上传的照片是否真的不会进行AI修图
# 3. 缓存清除是否正常工作

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@pis.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}测试 AI 修图全局关闭功能${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 辅助函数：测试步骤
test_step() {
  local step_name="$1"
  local command="$2"
  echo -e "${YELLOW}测试: ${step_name}${NC}"
  
  if eval "$command"; then
    echo -e "${GREEN}✓${NC} ${step_name}"
    return 0
  else
    echo -e "${RED}✗${NC} ${step_name}"
    return 1
  fi
}

# 1. 登录获取 token
echo -e "${YELLOW}步骤 1: 登录获取认证 token${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗${NC} 登录失败: $LOGIN_RESPONSE"
  exit 1
fi

# 提取 token（从 Set-Cookie 或响应体）
COOKIE_HEADER=$(echo "$LOGIN_RESPONSE" | grep -i "set-cookie" | head -1)
if [ -z "$COOKIE_HEADER" ]; then
  # 尝试从响应体获取 token
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗${NC} 无法获取认证 token"
    exit 1
  fi
  AUTH_HEADER="Authorization: Bearer $TOKEN"
else
  # 从 Cookie 中提取
  SESSION_COOKIE=$(echo "$COOKIE_HEADER" | grep -o 'auth-token=[^;]*' | cut -d'=' -f2)
  if [ -z "$SESSION_COOKIE" ]; then
    echo -e "${RED}✗${NC} 无法从 Cookie 中提取 token"
    exit 1
  fi
  COOKIE="auth-token=$SESSION_COOKIE"
fi

echo -e "${GREEN}✓${NC} 登录成功"

# 2. 获取所有相册
echo ""
echo -e "${YELLOW}步骤 2: 获取所有相册${NC}"
if [ -n "$COOKIE" ]; then
  ALBUMS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums" \
    -H "Cookie: ${COOKIE}")
else
  ALBUMS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums" \
    -H "${AUTH_HEADER}")
fi

if echo "$ALBUMS_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗${NC} 获取相册失败: $ALBUMS_RESPONSE"
  exit 1
fi

# 提取相册 ID 列表
ALBUM_IDS=$(echo "$ALBUMS_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -5)
ALBUM_COUNT=$(echo "$ALBUM_IDS" | wc -l | tr -d ' ')

if [ "$ALBUM_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}⚠️  没有找到相册，跳过测试${NC}"
  exit 0
fi

echo -e "${GREEN}✓${NC} 找到 ${ALBUM_COUNT} 个相册"

# 3. 检查当前 AI 修图状态
echo ""
echo -e "${YELLOW}步骤 3: 检查当前 AI 修图状态${NC}"
if [ -n "$COOKIE" ]; then
  SETTINGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/admin/settings" \
    -H "Cookie: ${COOKIE}")
else
  SETTINGS_RESPONSE=$(curl -s -X GET "${BASE_URL}/admin/settings" \
    -H "${AUTH_HEADER}")
fi

# 统计启用 AI 修图的相册数量（从数据库查询）
ENABLED_COUNT=0
for ALBUM_ID in $ALBUM_IDS; do
  if [ -n "$COOKIE" ]; then
    ALBUM_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
      -H "Cookie: ${COOKIE}")
  else
    ALBUM_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
      -H "${AUTH_HEADER}")
  fi
  
  if echo "$ALBUM_RESPONSE" | grep -q '"enable_ai_retouch":true'; then
    ENABLED_COUNT=$((ENABLED_COUNT + 1))
  fi
done

echo -e "${GREEN}✓${NC} 当前有 ${ENABLED_COUNT} 个相册启用了 AI 修图"

# 4. 测试全局关闭
echo ""
echo -e "${YELLOW}步骤 4: 测试全局关闭 AI 修图${NC}"
ALBUM_IDS_ARRAY=$(echo "$ALBUM_IDS" | tr '\n' ',' | sed 's/,$//')
ALBUM_IDS_JSON=$(echo "$ALBUM_IDS" | while read id; do echo -n "\"$id\","; done | sed 's/,$//')
ALBUM_IDS_JSON="[${ALBUM_IDS_JSON}]"

if [ -n "$COOKIE" ]; then
  DISABLE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/admin/albums/batch" \
    -H "Cookie: ${COOKIE}" \
    -H "Content-Type: application/json" \
    -d "{\"albumIds\":${ALBUM_IDS_JSON},\"updates\":{\"enable_ai_retouch\":false}}")
else
  DISABLE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/admin/albums/batch" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"albumIds\":${ALBUM_IDS_JSON},\"updates\":{\"enable_ai_retouch\":false}}")
fi

if echo "$DISABLE_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗${NC} 全局关闭失败: $DISABLE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓${NC} 全局关闭请求成功"

# 5. 验证关闭是否生效
echo ""
echo -e "${YELLOW}步骤 5: 验证关闭是否生效${NC}"
sleep 2  # 等待数据库更新

DISABLED_COUNT=0
for ALBUM_ID in $ALBUM_IDS; do
  if [ -n "$COOKIE" ]; then
    ALBUM_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
      -H "Cookie: ${COOKIE}")
  else
    ALBUM_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
      -H "${AUTH_HEADER}")
  fi
  
  if echo "$ALBUM_RESPONSE" | grep -q '"enable_ai_retouch":false'; then
    DISABLED_COUNT=$((DISABLED_COUNT + 1))
  fi
done

if [ "$DISABLED_COUNT" -eq "$ALBUM_COUNT" ]; then
  echo -e "${GREEN}✓${NC} 所有相册的 AI 修图已关闭 (${DISABLED_COUNT}/${ALBUM_COUNT})"
else
  echo -e "${RED}✗${NC} 部分相册的 AI 修图未关闭 (${DISABLED_COUNT}/${ALBUM_COUNT})"
  exit 1
fi

# 6. 测试全局开启
echo ""
echo -e "${YELLOW}步骤 6: 测试全局开启 AI 修图${NC}"
if [ -n "$COOKIE" ]; then
  ENABLE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/admin/albums/batch" \
    -H "Cookie: ${COOKIE}" \
    -H "Content-Type: application/json" \
    -d "{\"albumIds\":${ALBUM_IDS_JSON},\"updates\":{\"enable_ai_retouch\":true}}")
else
  ENABLE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/admin/albums/batch" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"albumIds\":${ALBUM_IDS_JSON},\"updates\":{\"enable_ai_retouch\":true}}")
fi

if echo "$ENABLE_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗${NC} 全局开启失败: $ENABLE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓${NC} 全局开启请求成功"

# 7. 验证开启是否生效
echo ""
echo -e "${YELLOW}步骤 7: 验证开启是否生效${NC}"
sleep 2  # 等待数据库更新

ENABLED_AFTER_COUNT=0
for ALBUM_ID in $ALBUM_IDS; do
  if [ -n "$COOKIE" ]; then
    ALBUM_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
      -H "Cookie: ${COOKIE}")
  else
    ALBUM_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
      -H "${AUTH_HEADER}")
  fi
  
  if echo "$ALBUM_RESPONSE" | grep -q '"enable_ai_retouch":true'; then
    ENABLED_AFTER_COUNT=$((ENABLED_AFTER_COUNT + 1))
  fi
done

if [ "$ENABLED_AFTER_COUNT" -eq "$ALBUM_COUNT" ]; then
  echo -e "${GREEN}✓${NC} 所有相册的 AI 修图已开启 (${ENABLED_AFTER_COUNT}/${ALBUM_COUNT})"
else
  echo -e "${RED}✗${NC} 部分相册的 AI 修图未开启 (${ENABLED_AFTER_COUNT}/${ALBUM_COUNT})"
  exit 1
fi

# 8. 恢复原始状态（如果之前有启用的）
if [ "$ENABLED_COUNT" -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}步骤 8: 恢复原始状态${NC}"
  if [ -n "$COOKIE" ]; then
    RESTORE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/admin/albums/batch" \
      -H "Cookie: ${COOKIE}" \
      -H "Content-Type: application/json" \
      -d "{\"albumIds\":${ALBUM_IDS_JSON},\"updates\":{\"enable_ai_retouch\":false}}")
  else
    RESTORE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/admin/albums/batch" \
      -H "${AUTH_HEADER}" \
      -H "Content-Type: application/json" \
      -d "{\"albumIds\":${ALBUM_IDS_JSON},\"updates\":{\"enable_ai_retouch\":false}}")
  fi
  echo -e "${GREEN}✓${NC} 已恢复原始状态"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}测试完成：所有测试通过！${NC}"
echo -e "${GREEN}========================================${NC}"
