#!/bin/bash
# ============================================
# PIS 数据库重置脚本
# ============================================
# ⚠️  警告：此脚本会删除所有数据！
# 
# 使用方法：
# 1. 确保 Docker 容器正在运行
# 2. 执行: ./docker/reset-database.sh [dev|prod]
#    默认检测环境，或手动指定 dev/prod
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# 检测环境（dev 或 prod）
ENV_MODE="${1:-auto}"

if [ "$ENV_MODE" = "auto" ]; then
    # 自动检测：优先检查开发环境容器
    if docker ps | grep -q "pis-postgres-dev"; then
        ENV_MODE="dev"
        echo "🔍 检测到开发环境"
    elif docker ps | grep -q "pis-postgres"; then
        ENV_MODE="prod"
        echo "🔍 检测到生产环境"
    else
        echo "❌ 错误: 未找到运行中的 PostgreSQL 容器"
        echo ""
        echo "请先启动数据库容器:"
        echo "  开发环境: docker-compose -f docker/docker-compose.dev.yml up -d postgres"
        echo "  生产环境: docker-compose -f docker/docker-compose.yml up -d postgres"
        exit 1
    fi
fi

# 根据环境设置变量
if [ "$ENV_MODE" = "dev" ]; then
    CONTAINER_NAME="pis-postgres-dev"
    COMPOSE_FILE="docker-compose.dev.yml"
    ENV_LABEL="开发环境"
elif [ "$ENV_MODE" = "prod" ]; then
    CONTAINER_NAME="pis-postgres"
    COMPOSE_FILE="docker-compose.yml"
    ENV_LABEL="生产环境"
else
    echo "❌ 错误: 无效的环境模式 '$ENV_MODE'"
    echo "   使用: dev 或 prod"
    exit 1
fi

# 读取环境变量
POSTGRES_DB="${POSTGRES_DB:-pis}"
POSTGRES_USER="${POSTGRES_USER:-pis}"

echo ""
echo "=========================================="
echo "PIS 数据库重置 ($ENV_LABEL)"
echo "=========================================="
echo ""

# 检查容器是否运行
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ 错误: PostgreSQL 容器 '$CONTAINER_NAME' 未运行"
    echo ""
    echo "请先启动数据库容器:"
    echo "  docker-compose -f docker/$COMPOSE_FILE up -d postgres"
    echo ""
    exit 1
fi

echo "📋 当前数据库状态:"
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
" 2>/dev/null || echo "  (无法查询表列表)"

echo ""
read -p "⚠️  确认要重置数据库吗？这将删除所有数据！(yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ 操作已取消"
    exit 0
fi

echo ""
echo "🔄 正在重置数据库..."

# 执行重置脚本
if docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SCRIPT_DIR/reset-postgresql-db.sql"; then
    echo "✅ 数据库表已删除"
else
    echo "❌ 重置脚本执行失败"
    exit 1
fi

# 重新初始化数据库
echo ""
echo "🔄 正在重新初始化数据库..."
if docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SCRIPT_DIR/init-postgresql-db.sql"; then
    echo "✅ 数据库表已重新创建"
else
    echo "❌ 初始化脚本执行失败"
    exit 1
fi

# 执行管理员账户初始化
echo ""
echo "🔄 正在初始化管理员账户..."
if docker exec "$CONTAINER_NAME" bash /docker-entrypoint-initdb.d/init-postgresql.sh; then
    echo "✅ 管理员账户已初始化"
else
    echo "⚠️  管理员账户初始化可能失败，请检查日志"
fi

echo ""
echo "=========================================="
echo "✅ 数据库重置完成！"
echo "=========================================="
echo ""
echo "📝 下一步:"
echo "   1. 重启应用服务以重新连接数据库"
echo "   2. 访问管理后台设置管理员密码（如果未设置）"
echo ""
