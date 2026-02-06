#!/bin/bash
# 登录调试测试脚本

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "=========================================="
echo "登录调试测试"
echo "=========================================="
echo ""
echo "测试 URL: $BASE_URL"
echo ""

# 1. 检查管理员状态
echo "1️⃣  检查管理员状态..."
admin_status=$(curl -s "$BASE_URL/api/auth/check-admin-status")
echo "响应: $admin_status"
echo ""

# 2. 尝试登录（使用 admin 用户名）
echo "2️⃣  尝试登录（用户名: admin）..."
login_response=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"test123456"}')

echo "HTTP 状态码: $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"test123456"}')"
echo "响应: $login_response"
echo ""

# 3. 尝试登录（使用邮箱）
echo "3️⃣  尝试登录（邮箱: admin@pis.com）..."
login_response2=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pis.com","password":"test123456"}')

echo "HTTP 状态码: $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pis.com","password":"test123456"}')"
echo "响应: $login_response2"
echo ""

echo "=========================================="
echo "请查看运行 'pnpm dev' 的终端窗口中的日志"
echo "查找包含 '[Login]' 或 '[VerifyPassword]' 的日志行"
echo "=========================================="
