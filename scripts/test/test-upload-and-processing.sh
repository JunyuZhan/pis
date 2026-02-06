#!/bin/bash

# 测试上传业务逻辑和处理正确性以及性能问题
# ⚠️ 要求：必须100%通过，任何失败都会导致测试退出
# 验证：
# 1. 上传流程完整性（必须100%成功）
# 2. 处理流程正确性（必须100%完成）
# 3. 性能指标
# 4. 错误处理
# 5. 并发上传和处理（必须100%成功）
#    - 并发上传（获取凭证、上传文件、触发处理）
#    - 并发处理完成验证（等待所有照片处理完成）
#    - 并发处理结果验证（验证缩略图和预览图）

set -e  # 任何命令失败都会退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@pis.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"
TEST_IMAGE_SIZE="${TEST_IMAGE_SIZE:-1024000}" # 1MB
CONCURRENT_UPLOADS="${CONCURRENT_UPLOADS:-5}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}测试上传业务逻辑和处理正确性${NC}"
echo -e "${RED}⚠️  要求：必须100%通过${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 辅助函数
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

# 创建测试图片（使用 ImageMagick 或 convert）
create_test_image() {
  local filename="$1"
  local size="$2"
  
  # 尝试使用 ImageMagick 创建测试图片
  if command -v convert &> /dev/null; then
    convert -size 1920x1080 xc:white -quality 85 "$filename" 2>/dev/null || true
  elif command -v magick &> /dev/null; then
    magick -size 1920x1080 xc:white -quality 85 "$filename" 2>/dev/null || true
  else
    # 如果没有 ImageMagick，创建一个简单的 JPEG 文件（最小有效 JPEG）
    # 这是一个最小的有效 JPEG 文件（1x1 像素）
    echo -ne '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.ff\xd9' > "$filename"
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

# 提取 cookie
COOKIE_HEADER=$(echo "$LOGIN_RESPONSE" | grep -i "set-cookie" | head -1)
if [ -z "$COOKIE_HEADER" ]; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
  if [ -z "$TOKEN" ]; then
    echo -e "${RED}✗${NC} 无法获取认证 token"
    exit 1
  fi
  AUTH_HEADER="Authorization: Bearer $TOKEN"
else
  SESSION_COOKIE=$(echo "$COOKIE_HEADER" | grep -o 'auth-token=[^;]*' | cut -d'=' -f2)
  if [ -z "$SESSION_COOKIE" ]; then
    echo -e "${RED}✗${NC} 无法从 Cookie 中提取 token"
    exit 1
  fi
  COOKIE="auth-token=$SESSION_COOKIE"
fi

echo -e "${GREEN}✓${NC} 登录成功"

# 2. 创建测试相册
echo ""
echo -e "${YELLOW}步骤 2: 创建测试相册${NC}"
ALBUM_TITLE="测试相册-$(date +%s)"
if [ -n "$COOKIE" ]; then
  ALBUM_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/albums" \
    -H "Cookie: ${COOKIE}" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"${ALBUM_TITLE}\",\"is_public\":false}")
else
  ALBUM_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/albums" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"${ALBUM_TITLE}\",\"is_public\":false}")
fi

if echo "$ALBUM_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗${NC} 创建相册失败: $ALBUM_RESPONSE"
  exit 1
fi

ALBUM_ID=$(echo "$ALBUM_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
if [ -z "$ALBUM_ID" ]; then
  echo -e "${RED}✗${NC} 无法获取相册 ID"
  exit 1
fi

echo -e "${GREEN}✓${NC} 创建相册成功: $ALBUM_ID"

# 3. 测试上传流程
echo ""
echo -e "${YELLOW}步骤 3: 测试上传流程${NC}"

# 创建测试图片
TEST_IMAGE="test_image_$(date +%s).jpg"
create_test_image "$TEST_IMAGE" "$TEST_IMAGE_SIZE"

if [ ! -f "$TEST_IMAGE" ]; then
  echo -e "${RED}✗${NC} 无法创建测试图片"
  exit 1
fi

echo -e "${BLUE}  创建测试图片: $TEST_IMAGE${NC}"

# 3.1 获取上传凭证
echo -e "${BLUE}  3.1 获取上传凭证${NC}"
if [ -n "$COOKIE" ]; then
  UPLOAD_CRED_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/albums/${ALBUM_ID}/upload" \
    -H "Cookie: ${COOKIE}" \
    -H "Content-Type: application/json" \
    -d "{\"filename\":\"test.jpg\",\"contentType\":\"image/jpeg\",\"fileSize\":$(stat -f%z "$TEST_IMAGE" 2>/dev/null || stat -c%s "$TEST_IMAGE" 2>/dev/null || echo 1024)}")
else
  UPLOAD_CRED_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/albums/${ALBUM_ID}/upload" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"filename\":\"test.jpg\",\"contentType\":\"image/jpeg\",\"fileSize\":$(stat -f%z "$TEST_IMAGE" 2>/dev/null || stat -c%s "$TEST_IMAGE" 2>/dev/null || echo 1024)}")
fi

if echo "$UPLOAD_CRED_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗${NC} 获取上传凭证失败: $UPLOAD_CRED_RESPONSE"
  rm -f "$TEST_IMAGE"
  exit 1
fi

PHOTO_ID=$(echo "$UPLOAD_CRED_RESPONSE" | grep -o '"photoId":"[^"]*' | cut -d'"' -f4)
UPLOAD_URL=$(echo "$UPLOAD_CRED_RESPONSE" | grep -o '"uploadUrl":"[^"]*' | cut -d'"' -f4)
ORIGINAL_KEY=$(echo "$UPLOAD_CRED_RESPONSE" | grep -o '"originalKey":"[^"]*' | cut -d'"' -f4)

if [ -z "$PHOTO_ID" ] || [ -z "$UPLOAD_URL" ]; then
  echo -e "${RED}✗${NC} 无法获取上传凭证"
  echo "Response: $UPLOAD_CRED_RESPONSE"
  rm -f "$TEST_IMAGE"
  exit 1
fi

echo -e "${GREEN}✓${NC} 获取上传凭证成功: Photo ID = $PHOTO_ID"

# 3.2 上传文件
echo -e "${BLUE}  3.2 上传文件${NC}"
UPLOAD_START_TIME=$(date +%s%N)
UPLOAD_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@${TEST_IMAGE}")
UPLOAD_END_TIME=$(date +%s%N)
UPLOAD_TIME=$(( (UPLOAD_END_TIME - UPLOAD_START_TIME) / 1000000 )) # 转换为毫秒

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -n1)
UPLOAD_BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "204" ]; then
  echo -e "${RED}✗${NC} 上传失败: HTTP $HTTP_CODE"
  echo "Response: $UPLOAD_BODY"
  rm -f "$TEST_IMAGE"
  exit 1
fi

echo -e "${GREEN}✓${NC} 上传成功 (耗时: ${UPLOAD_TIME}ms)"

# 3.3 触发处理
echo -e "${BLUE}  3.3 触发处理${NC}"
PROCESS_START_TIME=$(date +%s%N)
if [ -n "$COOKIE" ]; then
  PROCESS_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/photos/process" \
    -H "Cookie: ${COOKIE}" \
    -H "Content-Type: application/json" \
    -d "{\"photoId\":\"${PHOTO_ID}\",\"albumId\":\"${ALBUM_ID}\",\"originalKey\":\"${ORIGINAL_KEY}\"}")
else
  PROCESS_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/admin/photos/process" \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: application/json" \
    -d "{\"photoId\":\"${PHOTO_ID}\",\"albumId\":\"${ALBUM_ID}\",\"originalKey\":\"${ORIGINAL_KEY}\"}")
fi
PROCESS_END_TIME=$(date +%s%N)
PROCESS_TRIGGER_TIME=$(( (PROCESS_END_TIME - PROCESS_START_TIME) / 1000000 ))

if echo "$PROCESS_RESPONSE" | grep -q "error"; then
  echo -e "${RED}✗${NC} 触发处理失败: $PROCESS_RESPONSE"
  rm -f "$TEST_IMAGE"
  exit 1
else
  echo -e "${GREEN}✓${NC} 触发处理成功 (耗时: ${PROCESS_TRIGGER_TIME}ms)"
fi

# 4. 等待处理完成并验证
echo ""
echo -e "${YELLOW}步骤 4: 等待处理完成并验证（必须100%完成）${NC}"
MAX_WAIT_TIME=120 # 最多等待 120 秒（确保100%完成）
WAIT_INTERVAL=2  # 每 2 秒检查一次
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT_TIME ]; do
  if [ -n "$COOKIE" ]; then
    PHOTO_STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${PHOTO_ID}" \
      -H "Cookie: ${COOKIE}")
  else
    PHOTO_STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${PHOTO_ID}" \
      -H "${AUTH_HEADER}")
  fi
  
  PHOTO_STATUS=$(echo "$PHOTO_STATUS_RESPONSE" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
  
  if [ "$PHOTO_STATUS" = "completed" ]; then
    echo -e "${GREEN}✓${NC} 照片处理完成 (等待时间: ${ELAPSED}秒)"
    break
  elif [ "$PHOTO_STATUS" = "failed" ]; then
    echo -e "${RED}✗${NC} 照片处理失败"
    echo "Response: $PHOTO_STATUS_RESPONSE"
    rm -f "$TEST_IMAGE"
    exit 1
  fi
  
  sleep $WAIT_INTERVAL
  ELAPSED=$((ELAPSED + WAIT_INTERVAL))
  echo -e "${BLUE}  等待处理中... (${ELAPSED}/${MAX_WAIT_TIME}秒) - 状态: ${PHOTO_STATUS:-unknown}${NC}"
done

if [ "$PHOTO_STATUS" != "completed" ]; then
  echo -e "${RED}✗${NC} 处理超时或未完成 (状态: ${PHOTO_STATUS:-unknown})"
  echo "Response: $PHOTO_STATUS_RESPONSE"
  rm -f "$TEST_IMAGE"
  exit 1
fi

# 5. 验证处理结果
echo ""
echo -e "${YELLOW}步骤 5: 验证处理结果${NC}"

# 5.1 检查缩略图和预览图
if [ -n "$COOKIE" ]; then
  PHOTO_DETAIL_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${PHOTO_ID}" \
    -H "Cookie: ${COOKIE}")
else
  PHOTO_DETAIL_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${PHOTO_ID}" \
    -H "${AUTH_HEADER}")
fi

THUMB_KEY=$(echo "$PHOTO_DETAIL_RESPONSE" | grep -o '"thumb_key":"[^"]*' | cut -d'"' -f4)
PREVIEW_KEY=$(echo "$PHOTO_DETAIL_RESPONSE" | grep -o '"preview_key":"[^"]*' | cut -d'"' -f4)

if [ -n "$THUMB_KEY" ]; then
  echo -e "${GREEN}✓${NC} 缩略图已生成: $THUMB_KEY"
else
  echo -e "${RED}✗${NC} 缩略图未生成 - 处理不完整"
  echo "Response: $PHOTO_DETAIL_RESPONSE"
  rm -f "$TEST_IMAGE"
  exit 1
fi

if [ -n "$PREVIEW_KEY" ]; then
  echo -e "${GREEN}✓${NC} 预览图已生成: $PREVIEW_KEY"
else
  echo -e "${RED}✗${NC} 预览图未生成 - 处理不完整"
  echo "Response: $PHOTO_DETAIL_RESPONSE"
  rm -f "$TEST_IMAGE"
  exit 1
fi

# 6. 性能测试：并发上传（必须100%成功）
echo ""
echo -e "${YELLOW}步骤 6: 性能测试 - 并发上传（必须100%成功）${NC}"
echo -e "${BLUE}  并发数: ${CONCURRENT_UPLOADS}${NC}"

CONCURRENT_START_TIME=$(date +%s%N)
PIDS=()
CONCURRENT_PHOTO_IDS=()
CONCURRENT_RESULTS_FILE="/tmp/concurrent_results_$$.txt"
echo "" > "$CONCURRENT_RESULTS_FILE"

for i in $(seq 1 $CONCURRENT_UPLOADS); do
  (
    TEST_IMG="test_concurrent_${i}_$(date +%s).jpg"
    create_test_image "$TEST_IMG" "$TEST_IMAGE_SIZE"
    
    if [ -n "$COOKIE" ]; then
      CRED_RESP=$(curl -s -X POST "${BASE_URL}/api/admin/albums/${ALBUM_ID}/upload" \
        -H "Cookie: ${COOKIE}" \
        -H "Content-Type: application/json" \
        -d "{\"filename\":\"test_${i}.jpg\",\"contentType\":\"image/jpeg\",\"fileSize\":1024}")
    else
      CRED_RESP=$(curl -s -X POST "${BASE_URL}/api/admin/albums/${ALBUM_ID}/upload" \
        -H "${AUTH_HEADER}" \
        -H "Content-Type: application/json" \
        -d "{\"filename\":\"test_${i}.jpg\",\"contentType\":\"image/jpeg\",\"fileSize\":1024}")
    fi
    
    if echo "$CRED_RESP" | grep -q "error"; then
      echo "FAILED:$i:获取凭证失败:$CRED_RESP" >> "$CONCURRENT_RESULTS_FILE"
      rm -f "$TEST_IMG"
      exit 1
    fi
    
    PID=$(echo "$CRED_RESP" | grep -o '"photoId":"[^"]*' | cut -d'"' -f4)
    URL=$(echo "$CRED_RESP" | grep -o '"uploadUrl":"[^"]*' | cut -d'"' -f4)
    ORIG_KEY=$(echo "$CRED_RESP" | grep -o '"originalKey":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$PID" ] || [ -z "$URL" ]; then
      echo "FAILED:$i:无法获取凭证" >> "$CONCURRENT_RESULTS_FILE"
      rm -f "$TEST_IMG"
      exit 1
    fi
    
    UPLOAD_HTTP_CODE=$(curl -s -w "%{http_code}" -o /dev/null -X PUT "$URL" \
      -H "Content-Type: image/jpeg" \
      --data-binary "@${TEST_IMG}")
    
    if [ "$UPLOAD_HTTP_CODE" != "200" ] && [ "$UPLOAD_HTTP_CODE" != "204" ]; then
      echo "FAILED:$i:上传失败:HTTP $UPLOAD_HTTP_CODE" >> "$CONCURRENT_RESULTS_FILE"
      rm -f "$TEST_IMG"
      exit 1
    fi
    
    # 触发处理
    if [ -n "$COOKIE" ]; then
      PROCESS_RESP=$(curl -s -X POST "${BASE_URL}/api/admin/photos/process" \
        -H "Cookie: ${COOKIE}" \
        -H "Content-Type: application/json" \
        -d "{\"photoId\":\"${PID}\",\"albumId\":\"${ALBUM_ID}\",\"originalKey\":\"${ORIG_KEY}\"}")
    else
      PROCESS_RESP=$(curl -s -X POST "${BASE_URL}/api/admin/photos/process" \
        -H "${AUTH_HEADER}" \
        -H "Content-Type: application/json" \
        -d "{\"photoId\":\"${PID}\",\"albumId\":\"${ALBUM_ID}\",\"originalKey\":\"${ORIG_KEY}\"}")
    fi
    
    if echo "$PROCESS_RESP" | grep -q "error"; then
      echo "FAILED:$i:触发处理失败:$PROCESS_RESP" >> "$CONCURRENT_RESULTS_FILE"
      rm -f "$TEST_IMG"
      exit 1
    fi
    
    echo "SUCCESS:$i:$PID" >> "$CONCURRENT_RESULTS_FILE"
    rm -f "$TEST_IMG"
  ) &
  PIDS+=($!)
done

# 等待所有并发任务完成
CONCURRENT_SUCCESS=0
CONCURRENT_FAILED=0
for PID in "${PIDS[@]}"; do
  if wait $PID; then
    CONCURRENT_SUCCESS=$((CONCURRENT_SUCCESS + 1))
  else
    CONCURRENT_FAILED=$((CONCURRENT_FAILED + 1))
  fi
done

CONCURRENT_END_TIME=$(date +%s%N)
CONCURRENT_TIME=$(( (CONCURRENT_END_TIME - CONCURRENT_START_TIME) / 1000000 ))

# 读取结果
if [ -f "$CONCURRENT_RESULTS_FILE" ]; then
  CONCURRENT_PHOTO_IDS=($(grep "^SUCCESS:" "$CONCURRENT_RESULTS_FILE" | cut -d':' -f3))
  FAILED_COUNT=$(grep -c "^FAILED:" "$CONCURRENT_RESULTS_FILE" || echo "0")
  
  if [ "$FAILED_COUNT" -gt 0 ]; then
    echo -e "${RED}✗${NC} 并发上传失败详情:"
    grep "^FAILED:" "$CONCURRENT_RESULTS_FILE" | while IFS=':' read -r status num reason details; do
      echo -e "  ${RED}任务 $num 失败: $reason $details${NC}"
    done
  fi
  
  rm -f "$CONCURRENT_RESULTS_FILE"
fi

# 必须100%成功
if [ $CONCURRENT_SUCCESS -ne $CONCURRENT_UPLOADS ]; then
  echo -e "${RED}✗${NC} 并发上传失败: $CONCURRENT_SUCCESS/$CONCURRENT_UPLOADS 成功 (必须100%)"
  echo -e "${RED}失败数: $CONCURRENT_FAILED${NC}"
  rm -f "$TEST_IMAGE"
  exit 1
fi

echo -e "${GREEN}✓${NC} 并发上传完成 (总耗时: ${CONCURRENT_TIME}ms, 平均: $((CONCURRENT_TIME / CONCURRENT_UPLOADS))ms/张, 成功率: 100%)"

# 6.1 等待并发上传的照片处理完成
echo ""
echo -e "${YELLOW}步骤 6.1: 等待并发上传的照片处理完成（必须100%完成）${NC}"
CONCURRENT_MAX_WAIT=180 # 最多等待 180 秒
CONCURRENT_WAIT_INTERVAL=3  # 每 3 秒检查一次
CONCURRENT_ELAPSED=0
CONCURRENT_COMPLETED=0
CONCURRENT_FAILED_PHOTOS=()

# 等待所有并发上传的照片处理完成
while [ $CONCURRENT_ELAPSED -lt $CONCURRENT_MAX_WAIT ] && [ $CONCURRENT_COMPLETED -lt ${#CONCURRENT_PHOTO_IDS[@]} ]; do
  CONCURRENT_COMPLETED=0
  CONCURRENT_FAILED_PHOTOS=()
  
  for CONCURRENT_PID in "${CONCURRENT_PHOTO_IDS[@]}"; do
    if [ -z "$CONCURRENT_PID" ]; then
      continue
    fi
    
    if [ -n "$COOKIE" ]; then
      CONCURRENT_STATUS_RESP=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${CONCURRENT_PID}" \
        -H "Cookie: ${COOKIE}")
    else
      CONCURRENT_STATUS_RESP=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${CONCURRENT_PID}" \
        -H "${AUTH_HEADER}")
    fi
    
    CONCURRENT_STATUS=$(echo "$CONCURRENT_STATUS_RESP" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    
    if [ "$CONCURRENT_STATUS" = "completed" ]; then
      CONCURRENT_COMPLETED=$((CONCURRENT_COMPLETED + 1))
    elif [ "$CONCURRENT_STATUS" = "failed" ]; then
      CONCURRENT_FAILED_PHOTOS+=("$CONCURRENT_PID")
    fi
  done
  
  if [ $CONCURRENT_COMPLETED -eq ${#CONCURRENT_PHOTO_IDS[@]} ]; then
    break
  fi
  
  sleep $CONCURRENT_WAIT_INTERVAL
  CONCURRENT_ELAPSED=$((CONCURRENT_ELAPSED + CONCURRENT_WAIT_INTERVAL))
  echo -e "${BLUE}  等待并发处理中... (${CONCURRENT_ELAPSED}/${CONCURRENT_MAX_WAIT}秒) - 完成: ${CONCURRENT_COMPLETED}/${#CONCURRENT_PHOTO_IDS[@]}${NC}"
done

# 验证并发处理结果
if [ ${#CONCURRENT_FAILED_PHOTOS[@]} -gt 0 ]; then
  echo -e "${RED}✗${NC} 并发处理失败的照片:"
  for FAILED_PID in "${CONCURRENT_FAILED_PHOTOS[@]}"; do
    echo -e "  ${RED}Photo ID: $FAILED_PID${NC}"
  done
  rm -f "$TEST_IMAGE"
  exit 1
fi

if [ $CONCURRENT_COMPLETED -ne ${#CONCURRENT_PHOTO_IDS[@]} ]; then
  echo -e "${RED}✗${NC} 并发处理未100%完成: ${CONCURRENT_COMPLETED}/${#CONCURRENT_PHOTO_IDS[@]} (必须100%)"
  rm -f "$TEST_IMAGE"
  exit 1
fi

echo -e "${GREEN}✓${NC} 所有并发上传的照片处理完成 (${CONCURRENT_COMPLETED}/${#CONCURRENT_PHOTO_IDS[@]}, 100%)"

# 6.2 验证并发上传的处理结果
echo ""
echo -e "${YELLOW}步骤 6.2: 验证并发上传的处理结果（必须100%完整）${NC}"

# 确保 CONCURRENT_INCOMPLETE 已初始化
CONCURRENT_INCOMPLETE=0

# 如果并发上传成功，验证处理结果
if [ ${#CONCURRENT_PHOTO_IDS[@]} -gt 0 ]; then
  for CONCURRENT_PID in "${CONCURRENT_PHOTO_IDS[@]}"; do
    if [ -z "$CONCURRENT_PID" ]; then
      continue
    fi
    
    if [ -n "$COOKIE" ]; then
      CONCURRENT_DETAIL_RESP=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${CONCURRENT_PID}" \
        -H "Cookie: ${COOKIE}")
    else
      CONCURRENT_DETAIL_RESP=$(curl -s -X GET "${BASE_URL}/api/admin/photos/${CONCURRENT_PID}" \
        -H "${AUTH_HEADER}")
    fi
    
    CONCURRENT_THUMB=$(echo "$CONCURRENT_DETAIL_RESP" | grep -o '"thumb_key":"[^"]*' | cut -d'"' -f4)
    CONCURRENT_PREVIEW=$(echo "$CONCURRENT_DETAIL_RESP" | grep -o '"preview_key":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$CONCURRENT_THUMB" ] || [ -z "$CONCURRENT_PREVIEW" ]; then
      echo -e "${RED}✗${NC} Photo $CONCURRENT_PID 处理结果不完整 (thumb: ${CONCURRENT_THUMB:-缺失}, preview: ${CONCURRENT_PREVIEW:-缺失})"
      CONCURRENT_INCOMPLETE=$((CONCURRENT_INCOMPLETE + 1))
    else
      echo -e "${GREEN}✓${NC} Photo $CONCURRENT_PID 处理结果完整"
    fi
  done
  
  if [ $CONCURRENT_INCOMPLETE -gt 0 ]; then
    echo -e "${RED}✗${NC} 并发处理结果不完整: $CONCURRENT_INCOMPLETE/${#CONCURRENT_PHOTO_IDS[@]} 张照片 (必须100%完整)"
    rm -f "$TEST_IMAGE"
    exit 1
  fi
  
  echo -e "${GREEN}✓${NC} 所有并发上传的照片处理结果完整 (${#CONCURRENT_PHOTO_IDS[@]}/${#CONCURRENT_PHOTO_IDS[@]}, 100%)"
else
  echo -e "${YELLOW}⚠️  ${NC} 没有并发上传的照片，跳过验证"
  CONCURRENT_INCOMPLETE=0
fi

# 7. 清理
echo ""
echo -e "${YELLOW}步骤 7: 清理测试数据${NC}"
rm -f "$TEST_IMAGE"

# 可选：删除测试相册
# if [ -n "$COOKIE" ]; then
#   curl -s -X DELETE "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
#     -H "Cookie: ${COOKIE}" > /dev/null
# else
#   curl -s -X DELETE "${BASE_URL}/api/admin/albums/${ALBUM_ID}" \
#     -H "${AUTH_HEADER}" > /dev/null
# fi

echo -e "${GREEN}✓${NC} 清理完成"

# 8. 性能报告
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}性能报告${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "上传耗时: ${UPLOAD_TIME}ms"
echo -e "触发处理耗时: ${PROCESS_TRIGGER_TIME}ms"
echo -e "并发上传 (${CONCURRENT_UPLOADS}张): ${CONCURRENT_TIME}ms (平均: $((CONCURRENT_TIME / CONCURRENT_UPLOADS))ms/张)"
echo ""

# 9. 最终验证：确保100%成功
echo ""
echo -e "${YELLOW}步骤 9: 最终验证（必须100%成功）${NC}"

# 验证所有关键步骤都成功
VERIFICATION_FAILED=0

# 验证1: 单文件上传和处理
if [ "$PHOTO_STATUS" != "completed" ]; then
  echo -e "${RED}✗${NC} 单文件处理未完成"
  VERIFICATION_FAILED=$((VERIFICATION_FAILED + 1))
fi

if [ -z "$THUMB_KEY" ] || [ -z "$PREVIEW_KEY" ]; then
  echo -e "${RED}✗${NC} 单文件处理结果不完整"
  VERIFICATION_FAILED=$((VERIFICATION_FAILED + 1))
fi

# 验证2: 并发上传
if [ $CONCURRENT_SUCCESS -ne $CONCURRENT_UPLOADS ]; then
  echo -e "${RED}✗${NC} 并发上传未100%成功: $CONCURRENT_SUCCESS/$CONCURRENT_UPLOADS"
  VERIFICATION_FAILED=$((VERIFICATION_FAILED + 1))
fi

# 验证3: 并发处理完成（如果进行了并发测试）
if [ ${#CONCURRENT_PHOTO_IDS[@]} -gt 0 ]; then
  if [ $CONCURRENT_COMPLETED -ne ${#CONCURRENT_PHOTO_IDS[@]} ]; then
    echo -e "${RED}✗${NC} 并发处理未100%完成: $CONCURRENT_COMPLETED/${#CONCURRENT_PHOTO_IDS[@]}"
    VERIFICATION_FAILED=$((VERIFICATION_FAILED + 1))
  fi
  
  # 验证4: 并发处理结果完整
  if [ ${CONCURRENT_INCOMPLETE:-0} -gt 0 ]; then
    echo -e "${RED}✗${NC} 并发处理结果不完整: $CONCURRENT_INCOMPLETE 张照片"
    VERIFICATION_FAILED=$((VERIFICATION_FAILED + 1))
  fi
else
  echo -e "${YELLOW}⚠️  ${NC} 未进行并发测试，跳过并发验证"
fi

if [ $VERIFICATION_FAILED -gt 0 ]; then
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}测试失败：未达到100%成功率${NC}"
  echo -e "${RED}失败项数: $VERIFICATION_FAILED${NC}"
  echo -e "${RED}========================================${NC}"
  rm -f "$TEST_IMAGE"
  exit 1
fi

# 10. 总结
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 测试完成：100% 通过${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ 单文件上传和处理: 100% 成功${NC}"
echo -e "${GREEN}✓ 并发上传: 100% 成功 (${CONCURRENT_UPLOADS}/${CONCURRENT_UPLOADS})${NC}"
echo -e "${GREEN}✓ 并发处理完成: 100% 完成 (${CONCURRENT_COMPLETED}/${#CONCURRENT_PHOTO_IDS[@]})${NC}"
echo -e "${GREEN}✓ 并发处理结果: 100% 完整${NC}"
echo -e "${GREEN}✓ 单文件处理结果验证: 100% 完整${NC}"
echo ""
