#!/bin/bash
# ============================================
# PIS 数据库重置脚本
# ============================================
# ⚠️  警告：此脚本会删除所有数据！
#
# 使用方法：
# 1. 确保 Docker 中 PostgreSQL 已启动（docker compose -f docker/docker-compose.yml）
# 2. 执行: ./docker/reset-database.sh
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE=(docker compose -f docker/docker-compose.yml)
ENV_LABEL="PostgreSQL（docker/docker-compose.yml）"

POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"

echo ""
echo "=========================================="
echo "PIS 数据库重置 ($ENV_LABEL)"
echo "=========================================="
echo ""

if ! "${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null 2>&1; then
    echo "❌ 错误: PostgreSQL 服务 postgres 未运行或无法连接"
    echo ""
    echo "请先启动（仓库根目录执行）："
    echo "  ${COMPOSE[*]} up -d postgres"
    echo "  或启动完整栈: ${COMPOSE[*]} up -d"
    echo ""
    exit 1
fi

echo "📋 当前数据库状态:"
"${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
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

if "${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SCRIPT_DIR/reset-postgresql-db.sql"; then
    echo "✅ 数据库表已删除"
else
    echo "❌ 重置脚本执行失败"
    exit 1
fi

echo ""
echo "🔄 正在重新初始化数据库..."
if "${COMPOSE[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$SCRIPT_DIR/init-postgresql-db.sql"; then
    echo "✅ 数据库表已重新创建"
else
    echo "❌ 初始化脚本执行失败"
    exit 1
fi

echo ""
echo "🔄 正在初始化管理员账户..."
if "${COMPOSE[@]}" exec -T postgres bash /docker-entrypoint-initdb.d/init-postgresql.sh; then
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
