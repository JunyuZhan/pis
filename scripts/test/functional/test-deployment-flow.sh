#!/bin/bash
# ============================================
# 部署流程测试脚本
# 测试部署流程是否能顺利实现目的
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 测试步骤计数
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

# 测试步骤函数
test_step() {
    local name="$1"
    local command="$2"
    TEST_COUNT=$((TEST_COUNT + 1))
    
    echo -e "${CYAN}[$TEST_COUNT]${NC} ${BOLD}$name${NC}"
    
    if eval "$command" > /tmp/test-deploy-output.log 2>&1; then
        echo -e "${GREEN}✓${NC} 通过"
        PASS_COUNT=$((PASS_COUNT + 1))
        return 0
    else
        echo -e "${RED}✗${NC} 失败"
        echo -e "${YELLOW}输出:${NC}"
        cat /tmp/test-deploy-output.log | head -20
        FAIL_COUNT=$((FAIL_COUNT + 1))
        return 1
    fi
}

# 检查函数
check_file_exists() {
    local file="$1"
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} 文件存在: $file"
        return 0
    else
        echo -e "${RED}✗${NC} 文件不存在: $file"
        return 1
    fi
}

check_script_executable() {
    local script="$1"
    if [ -x "$script" ] || [ -f "$script" ]; then
        echo -e "${GREEN}✓${NC} 脚本可执行: $script"
        return 0
    else
        echo -e "${RED}✗${NC} 脚本不可执行: $script"
        return 1
    fi
}

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   📋 部署流程测试                                          ║${NC}"
echo -e "${CYAN}║   Deployment Flow Test                                    ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. 检查部署脚本是否存在
echo -e "${BOLD}1. 检查部署脚本${NC}"
echo ""

check_file_exists "scripts/deploy/one-click-deploy.sh"
check_file_exists "docker/deploy.sh"
check_file_exists "docker/init-postgresql.sh"
check_file_exists "docker/init-postgresql-db.sql"
check_file_exists "scripts/utils/init-users.ts"
check_script_executable "scripts/deploy/one-click-deploy.sh"
check_script_executable "docker/deploy.sh"
check_script_executable "docker/init-postgresql.sh"

echo ""

# 2. 检查硬编码问题
echo -e "${BOLD}2. 检查硬编码问题${NC}"
echo ""

echo "检查 init-postgresql.sh 中的硬编码邮箱..."
if grep -q "admin@example.com" docker/init-postgresql.sh; then
    echo -e "${YELLOW}⚠️  发现硬编码: docker/init-postgresql.sh 中使用 admin@example.com${NC}"
    echo "   问题: 数据库初始化脚本使用 admin@pis.com，但 init-postgresql.sh 查找 admin@example.com"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo -e "${GREEN}✓${NC} 未发现硬编码问题"
    PASS_COUNT=$((PASS_COUNT + 1))
fi

echo ""
echo "检查 deploy.sh 中的硬编码邮箱..."
if grep -q "admin@example.com" docker/deploy.sh; then
    echo -e "${YELLOW}⚠️  发现硬编码: docker/deploy.sh 中使用 admin@example.com${NC}"
    echo "   位置: 当 DOMAIN=localhost 时，使用 admin@example.com"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo -e "${GREEN}✓${NC} 未发现硬编码问题"
    PASS_COUNT=$((PASS_COUNT + 1))
fi

echo ""
echo "检查数据库初始化脚本中的邮箱..."
if grep -q "admin@pis.com" docker/init-postgresql-db.sql; then
    echo -e "${GREEN}✓${NC} 数据库初始化脚本使用 admin@pis.com"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} 数据库初始化脚本未找到 admin@pis.com"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 3. 检查部署流程一致性
echo -e "${BOLD}3. 检查部署流程一致性${NC}"
echo ""

echo "检查 one-click-deploy.sh 是否使用 init-users..."
if grep -q "pnpm init-users" scripts/deploy/one-click-deploy.sh; then
    echo -e "${GREEN}✓${NC} one-click-deploy.sh 使用 pnpm init-users（正确）"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} one-click-deploy.sh 未使用 pnpm init-users"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "检查 init-users.ts 是否支持环境变量..."
if grep -q "INIT_ADMIN_EMAIL" scripts/utils/init-users.ts; then
    echo -e "${GREEN}✓${NC} init-users.ts 支持 INIT_ADMIN_EMAIL 环境变量"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} init-users.ts 不支持 INIT_ADMIN_EMAIL 环境变量"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 4. 检查数据库初始化流程
echo -e "${BOLD}4. 检查数据库初始化流程${NC}"
echo ""

echo "检查 init-postgresql-db.sql 是否创建 admin@pis.com..."
if grep -q "admin@pis.com" docker/init-postgresql-db.sql; then
    echo -e "${GREEN}✓${NC} 数据库初始化脚本创建 admin@pis.com"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} 数据库初始化脚本未创建 admin@pis.com"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""
echo "检查 init-postgresql.sh 是否查找正确的邮箱..."
if grep -q "admin@example.com" docker/init-postgresql.sh; then
    echo -e "${RED}✗${NC} init-postgresql.sh 查找 admin@example.com（与数据库不一致）"
    echo "   应该查找 admin@pis.com 或动态查找第一个管理员账户"
    FAIL_COUNT=$((FAIL_COUNT + 1))
else
    echo -e "${GREEN}✓${NC} init-postgresql.sh 未硬编码邮箱"
    PASS_COUNT=$((PASS_COUNT + 1))
fi

echo ""

# 5. 检查部署信息显示
echo -e "${BOLD}5. 检查部署信息显示${NC}"
echo ""

echo "检查 one-click-deploy.sh 显示的管理员邮箱..."
if grep -q "admin@\${DOMAIN}" scripts/deploy/one-click-deploy.sh; then
    echo -e "${GREEN}✓${NC} one-click-deploy.sh 显示 admin@\${DOMAIN}（动态）"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${YELLOW}⚠️  one-click-deploy.sh 可能硬编码了邮箱${NC}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 6. 总结
echo -e "${BOLD}测试总结${NC}"
echo ""
echo -e "总测试数: $TEST_COUNT"
echo -e "${GREEN}通过: $PASS_COUNT${NC}"
echo -e "${RED}失败: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  发现 $FAIL_COUNT 个问题，需要修复${NC}"
    exit 1
fi
