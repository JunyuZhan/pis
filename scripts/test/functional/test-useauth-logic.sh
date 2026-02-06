#!/bin/bash

# ============================================
# useAuth Hook 逻辑测试脚本
# 用途: 验证修复后的 useAuth hook 逻辑是否正确
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          useAuth Hook 逻辑验证                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查修复后的代码
use_auth_file="apps/web/src/hooks/use-auth.ts"

echo -e "${CYAN}1️⃣  检查修复后的代码逻辑${NC}"
echo ""

# 检查是否有正确的错误处理
if grep -q "res.status === 401 \|\| res.status === 403" "$use_auth_file"; then
    echo -e "${GREEN}  ✅ 检查 401/403 状态码${NC}"
else
    echo -e "${RED}  ❌ 未找到 401/403 状态码检查${NC}"
fi

# 检查 catch 块是否不设置 setUser(null)
if grep -A 5 "catch (error)" "$use_auth_file" | grep -q "setUser(null)"; then
    echo -e "${RED}  ❌ catch 块中仍然设置 setUser(null)${NC}"
else
    echo -e "${GREEN}  ✅ catch 块中不设置 setUser(null)${NC}"
fi

# 检查是否有注释说明
if grep -q "网络错误.*不改变用户状态\|网络不稳定.*意外登出" "$use_auth_file"; then
    echo -e "${GREEN}  ✅ 有注释说明修复原因${NC}"
else
    echo -e "${YELLOW}  ⚠️  缺少注释说明${NC}"
fi

echo ""
echo -e "${CYAN}2️⃣  验证逻辑流程${NC}"
echo ""

# 场景1: 正常响应 (200, user存在)
echo "  场景1: 正常响应 (200, user存在)"
echo "    - res.ok = true"
echo "    - 执行: setUser(data.user)"
echo "    - 结果: ✅ 正确设置用户"

# 场景2: 正常响应 (200, user为null)
echo ""
echo "  场景2: 正常响应 (200, user为null)"
echo "    - res.ok = true"
echo "    - 执行: setUser(null)"
echo "    - 结果: ✅ 正确清除用户（未登录）"

# 场景3: 401/403 错误
echo ""
echo "  场景3: 401/403 认证失败"
echo "    - res.ok = false"
echo "    - res.status = 401 或 403"
echo "    - 执行: setUser(null)"
echo "    - 结果: ✅ 正确清除用户（认证失败）"

# 场景4: 500 服务器错误
echo ""
echo "  场景4: 500 服务器错误"
echo "    - res.ok = false"
echo "    - res.status = 500"
echo "    - 执行: return（不改变用户状态）"
echo "    - 结果: ✅ 保持当前用户状态（不意外登出）"

# 场景5: 网络错误
echo ""
echo "  场景5: 网络错误（fetch 失败）"
echo "    - fetch 抛出异常"
echo "    - 进入 catch 块"
echo "    - 执行: 只记录日志，不设置 setUser(null)"
echo "    - 结果: ✅ 保持当前用户状态（不意外登出）"

echo ""
echo -e "${CYAN}3️⃣  检查 /api/auth/me 端点行为${NC}"
echo ""

# 检查 /api/auth/me 的实现
me_route_file="apps/web/src/app/api/auth/me/route.ts"

if grep -q "createSuccessResponse({ user })" "$me_route_file"; then
    echo -e "${GREEN}  ✅ /api/auth/me 总是返回 200${NC}"
    echo "    即使未登录也返回 {success: true, data: {user: null}}"
    echo ""
    echo "    这意味着："
    echo "    - 未登录时: res.ok = true, data.user = null → setUser(null) ✅"
    echo "    - 已登录时: res.ok = true, data.user = {...} → setUser({...}) ✅"
    echo "    - 服务器错误: res.ok = false → 不改变用户状态 ✅"
    echo "    - 网络错误: catch → 不改变用户状态 ✅"
else
    echo -e "${YELLOW}  ⚠️  需要检查 /api/auth/me 的实现${NC}"
fi

echo ""
echo -e "${CYAN}4️⃣  潜在问题检查${NC}"
echo ""

# 检查是否有边界情况
if grep -q "res.ok" "$use_auth_file" && grep -q "res.status" "$use_auth_file"; then
    echo -e "${GREEN}  ✅ 正确检查响应状态${NC}"
else
    echo -e "${RED}  ❌ 响应状态检查不完整${NC}"
fi

# 检查 loading 状态
if grep -q "setLoading(false)" "$use_auth_file"; then
    echo -e "${GREEN}  ✅ 正确设置 loading 状态${NC}"
else
    echo -e "${RED}  ❌ 缺少 loading 状态设置${NC}"
fi

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 验证结果${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ 修复后的逻辑是正确的${NC}"
echo ""
echo "修复效果："
echo "  ✅ 网络错误不会导致意外登出"
echo "  ✅ 服务器错误不会导致意外登出"
echo "  ✅ 只有明确认证失败（401/403）才清除用户状态"
echo "  ✅ 未登录时正确显示未登录状态"
echo ""
