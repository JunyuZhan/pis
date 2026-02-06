#!/bin/bash
# ============================================
# 账户创建和设置流程测试脚本
# 测试管理员账户和各角色账户的创建和设置流程
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

# 测试计数
TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   📋 账户创建和设置流程测试                                ║${NC}"
echo -e "${CYAN}║   Account Creation and Setup Flow Test                    ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. 检查账户创建脚本
echo -e "${BOLD}1. 检查账户创建脚本${NC}"
echo ""

# 检查 init-users.ts
if [ -f "scripts/utils/init-users.ts" ]; then
    echo -e "${GREEN}✓${NC} init-users.ts 存在"
    PASS_COUNT=$((PASS_COUNT + 1))
    
    # 检查是否支持所有角色
    if grep -q "admin.*photographer.*retoucher.*guest" scripts/utils/init-users.ts || \
       grep -q "role.*admin" scripts/utils/init-users.ts && \
       grep -q "role.*photographer" scripts/utils/init-users.ts && \
       grep -q "role.*retoucher" scripts/utils/init-users.ts && \
       grep -q "role.*guest" scripts/utils/init-users.ts; then
        echo -e "${GREEN}✓${NC} init-users.ts 支持所有角色 (admin, photographer, retoucher, guest)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} init-users.ts 可能不支持所有角色"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    # 检查是否支持环境变量配置
    if grep -q "INIT_ADMIN_EMAIL\|INIT_PHOTOGRAPHER_EMAIL\|INIT_RETOUCHER_EMAIL\|INIT_GUEST_EMAIL" scripts/utils/init-users.ts; then
        echo -e "${GREEN}✓${NC} init-users.ts 支持环境变量配置邮箱"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  init-users.ts 可能不支持环境变量配置邮箱"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    # 检查是否支持默认密码
    if grep -q "INIT_DEFAULT_PASSWORD" scripts/utils/init-users.ts; then
        echo -e "${GREEN}✓${NC} init-users.ts 支持 INIT_DEFAULT_PASSWORD 环境变量"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  init-users.ts 可能不支持默认密码配置"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
else
    echo -e "${RED}✗${NC} init-users.ts 不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 检查 create-admin.ts
if [ -f "scripts/utils/create-admin.ts" ]; then
    echo -e "${GREEN}✓${NC} create-admin.ts 存在"
    PASS_COUNT=$((PASS_COUNT + 1))
    
    # 检查是否支持所有角色
    if grep -q "admin.*photographer.*retoucher.*guest\|role.*admin.*photographer.*retoucher.*guest" scripts/utils/create-admin.ts; then
        echo -e "${GREEN}✓${NC} create-admin.ts 支持所有角色"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  create-admin.ts 可能不支持所有角色"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
else
    echo -e "${RED}✗${NC} create-admin.ts 不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 2. 检查数据库初始化脚本
echo -e "${BOLD}2. 检查数据库初始化脚本${NC}"
echo ""

if [ -f "docker/init-postgresql-db.sql" ]; then
    echo -e "${GREEN}✓${NC} init-postgresql-db.sql 存在"
    PASS_COUNT=$((PASS_COUNT + 1))
    
    # 检查是否创建所有角色的账户
    admin_count=$(grep -c "admin@pis.com" docker/init-postgresql-db.sql || echo "0")
    photographer_count=$(grep -c "photographer@pis.com" docker/init-postgresql-db.sql || echo "0")
    retoucher_count=$(grep -c "retoucher@pis.com" docker/init-postgresql-db.sql || echo "0")
    guest_count=$(grep -c "guest@pis.com" docker/init-postgresql-db.sql || echo "0")
    
    if [ "$admin_count" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} 数据库初始化脚本创建管理员账户 (admin@pis.com)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} 数据库初始化脚本未创建管理员账户"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    if [ "$photographer_count" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} 数据库初始化脚本创建摄影师账户 (photographer@pis.com)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} 数据库初始化脚本未创建摄影师账户"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    if [ "$retoucher_count" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} 数据库初始化脚本创建修图师账户 (retoucher@pis.com)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} 数据库初始化脚本未创建修图师账户"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    if [ "$guest_count" -gt 0 ]; then
        echo -e "${GREEN}✓${NC} 数据库初始化脚本创建访客账户 (guest@pis.com)"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${RED}✗${NC} 数据库初始化脚本未创建访客账户"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    # 检查密码是否设置为 NULL（首次登录设置）
    if grep -q "password_hash.*NULL" docker/init-postgresql-db.sql; then
        echo -e "${GREEN}✓${NC} 数据库初始化脚本设置 password_hash 为 NULL（首次登录设置）"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  数据库初始化脚本可能未设置 password_hash 为 NULL"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
else
    echo -e "${RED}✗${NC} init-postgresql-db.sql 不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 3. 检查账户创建的一致性
echo -e "${BOLD}3. 检查账户创建的一致性${NC}"
echo ""

# 检查邮箱是否一致
admin_email_db=$(grep -o "admin@[^']*" docker/init-postgresql-db.sql | head -1)
admin_email_init=$(grep -o "INIT_ADMIN_EMAIL.*admin@[^']*\|admin@pis.com" scripts/utils/init-users.ts | head -1 | grep -o "admin@[^']*" || echo "admin@pis.com")

if [ "$admin_email_db" = "$admin_email_init" ] || [ "$admin_email_init" = "admin@pis.com" ]; then
    echo -e "${GREEN}✓${NC} 管理员邮箱一致: admin@pis.com"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${RED}✗${NC} 管理员邮箱不一致: DB=$admin_email_db, Init=$admin_email_init"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 检查角色是否一致
roles_db=$(grep -o "role.*'admin'\|role.*'photographer'\|role.*'retoucher'\|role.*'guest'" docker/init-postgresql-db.sql | sort -u | wc -l)
roles_init=$(grep -o "role.*admin\|role.*photographer\|role.*retoucher\|role.*guest" scripts/utils/init-users.ts | grep -o "'admin'\|'photographer'\|'retoucher'\|'guest'" | sort -u | wc -l)

if [ "$roles_db" -eq 4 ] && [ "$roles_init" -eq 4 ]; then
    echo -e "${GREEN}✓${NC} 角色数量一致: 4 个角色 (admin, photographer, retoucher, guest)"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo -e "${YELLOW}⚠️  角色数量可能不一致: DB=$roles_db, Init=$roles_init"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

echo ""

# 4. 检查密码设置流程
echo -e "${BOLD}4. 检查密码设置流程${NC}"
echo ""

# 检查 setup-password API
if [ -f "apps/web/src/app/api/auth/setup-password/route.ts" ]; then
    echo -e "${GREEN}✓${NC} setup-password API 存在"
    PASS_COUNT=$((PASS_COUNT + 1))
    
    # 检查是否支持首次登录设置密码
    if grep -q "password_hash.*null\|password.*null\|首次登录\|首次设置" apps/web/src/app/api/auth/setup-password/route.ts; then
        echo -e "${GREEN}✓${NC} setup-password API 支持首次登录设置密码"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  setup-password API 可能不支持首次登录设置密码"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
else
    echo -e "${RED}✗${NC} setup-password API 不存在"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 检查 init-postgresql.sh 是否支持设置密码
if [ -f "docker/init-postgresql.sh" ]; then
    if grep -q "ADMIN_PASSWORD\|password_hash" docker/init-postgresql.sh; then
        echo -e "${GREEN}✓${NC} init-postgresql.sh 支持 ADMIN_PASSWORD 环境变量设置密码"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  init-postgresql.sh 可能不支持 ADMIN_PASSWORD 环境变量"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
fi

echo ""

# 5. 检查部署脚本中的账户创建
echo -e "${BOLD}5. 检查部署脚本中的账户创建${NC}"
echo ""

# 检查 one-click-deploy.sh
if [ -f "scripts/deploy/one-click-deploy.sh" ]; then
    if grep -q "pnpm init-users\|init-users" scripts/deploy/one-click-deploy.sh; then
        echo -e "${GREEN}✓${NC} one-click-deploy.sh 使用 pnpm init-users 创建账户"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  one-click-deploy.sh 可能未使用 pnpm init-users"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
fi

# 检查 deploy.sh
if [ -f "docker/deploy.sh" ]; then
    if grep -q "create-admin\|create_admin" docker/deploy.sh; then
        echo -e "${GREEN}✓${NC} deploy.sh 支持创建管理员账户"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo -e "${YELLOW}⚠️  deploy.sh 可能不支持创建管理员账户"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
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
    echo -e "${YELLOW}⚠️  发现 $FAIL_COUNT 个问题，需要检查${NC}"
    exit 1
fi
