#!/bin/bash
# ============================================
# PIS 数据库迁移脚本
# ============================================
# 用途：为已有系统（老系统）执行数据库迁移，添加新表结构
# 
# ⚠️  重要说明：
#   - 此脚本用于已有系统的数据库结构升级
#   - 新部署应使用 init-postgresql-db.sql（已包含所有最新表结构）
#   - 系统升级时，建议使用升级脚本（scripts/deploy/quick-upgrade.sh）
#   - 升级脚本会自动调用此迁移脚本
# 
# 注意：迁移脚本使用 IF NOT EXISTS，不会破坏现有数据
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# 打印带颜色的消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}$1${NC}"
}

# 检查 Docker 容器
check_container() {
    if ! docker ps | grep -q "pis-postgres"; then
        print_error "PostgreSQL 容器未运行"
        echo ""
        echo "请先启动容器："
        echo "  cd docker"
        echo "  docker compose up -d postgres"
        exit 1
    fi
}

# 检查数据库连接
check_database() {
    print_info "检查数据库连接..."
    
    # 从环境变量读取配置（如果存在）
    if [ -f "$SCRIPT_DIR/../.env" ]; then
        source "$SCRIPT_DIR/../.env"
    fi
    
    DATABASE_USER="${DATABASE_USER:-pis}"
    DATABASE_NAME="${DATABASE_NAME:-pis}"
    
    if ! docker exec pis-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "无法连接到数据库"
        echo ""
        echo "请检查："
        echo "  1. 数据库容器是否运行"
        echo "  2. 数据库用户和名称是否正确"
        echo "  3. .env 文件中的配置是否正确"
        exit 1
    fi
    
    print_success "数据库连接正常"
}

# 检查表是否存在
check_table_exists() {
    local table_name="$1"
    docker exec pis-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" -tAc \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '$table_name');" 2>/dev/null | grep -q "t"
}

# 执行迁移
run_migrations() {
    print_info "开始执行数据库迁移..."
    echo ""
    
    # 检查迁移脚本目录
    if [ ! -d "$MIGRATIONS_DIR" ]; then
        print_error "迁移脚本目录不存在: $MIGRATIONS_DIR"
        exit 1
    fi
    
    # 获取所有迁移脚本并按文件名排序
    local migration_files=($(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort))
    
    if [ ${#migration_files[@]} -eq 0 ]; then
        print_warning "未找到迁移脚本"
        exit 0
    fi
    
    echo -e "${BOLD}找到 ${#migration_files[@]} 个迁移脚本${NC}"
    echo ""
    
    # 显示将要执行的迁移脚本
    print_info "迁移脚本列表："
    for migration_file in "${migration_files[@]}"; do
        echo "  - $(basename "$migration_file")"
    done
    echo ""
    
    # 检查关键表是否存在（判断是否需要迁移）
    local needs_migration=false
    local critical_tables=(
        "system_settings"
        "permissions"
        "audit_logs"
        "upgrade_history"
    )
    
    for table in "${critical_tables[@]}"; do
        if ! check_table_exists "$table"; then
            needs_migration=true
            break
        fi
    done
    
    if [ "$needs_migration" = false ]; then
        print_info "数据库已包含所有关键表，可能不需要迁移"
        echo ""
        echo -e "${CYAN}说明：${NC}"
        echo "  - 迁移脚本是给已有系统（老系统）升级用的"
        echo "  - 新部署应使用 init-postgresql-db.sql"
        echo "  - 系统升级时，建议使用升级脚本（scripts/deploy/quick-upgrade.sh）"
        echo ""
        read -p "是否继续执行迁移脚本？(y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            echo "已取消"
            exit 0
        fi
    fi
    
    echo ""
    print_warning "⚠️  重要提示："
    echo "  - 此脚本用于已有系统的数据库结构升级"
    echo "  - 执行迁移前请先备份数据库"
    echo "  - 迁移脚本使用 IF NOT EXISTS，不会破坏现有数据"
    echo "  - 建议在测试环境先验证迁移脚本"
    echo ""
    
    read -p "确认执行迁移？(y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "已取消"
        exit 0
    fi
    
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  开始执行迁移${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    
    local success_count=0
    local fail_count=0
    local skipped_count=0
    
    # 执行每个迁移脚本
    for migration_file in "${migration_files[@]}"; do
        local migration_name=$(basename "$migration_file")
        echo -e "${CYAN}[$((success_count + fail_count + skipped_count + 1))/${#migration_files[@]}] 执行: ${NC}$migration_name"
        
        # 执行迁移
        if docker exec -i pis-postgres psql -U "$DATABASE_USER" -d "$DATABASE_NAME" < "$migration_file" 2>&1 | tee /tmp/migration-output.log; then
            # 检查是否有错误（PostgreSQL 错误会输出到 stderr，但 exit code 可能仍为 0）
            if grep -qi "error\|fatal" /tmp/migration-output.log 2>/dev/null; then
                print_error "迁移失败: $migration_name"
                fail_count=$((fail_count + 1))
                echo ""
                echo -e "${YELLOW}是否继续执行后续迁移？${NC}"
                read -p "(y/N): " continue_confirm
                if [[ ! "$continue_confirm" =~ ^[Yy]$ ]]; then
                    break
                fi
            else
                print_success "迁移完成: $migration_name"
                success_count=$((success_count + 1))
            fi
        else
            print_error "迁移失败: $migration_name"
            fail_count=$((fail_count + 1))
            echo ""
            echo -e "${YELLOW}是否继续执行后续迁移？${NC}"
            read -p "(y/N): " continue_confirm
            if [[ ! "$continue_confirm" =~ ^[Yy]$ ]]; then
                break
            fi
        fi
        echo ""
    done
    
    # 清理临时文件
    rm -f /tmp/migration-output.log
    
    # 显示结果
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  迁移执行完成${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
    echo "  成功: $success_count"
    if [ $fail_count -gt 0 ]; then
        echo "  失败: $fail_count"
        print_warning "部分迁移失败，请检查日志并手动修复"
    fi
    if [ $skipped_count -gt 0 ]; then
        echo "  跳过: $skipped_count"
    fi
    echo ""
    
    if [ $fail_count -eq 0 ]; then
        print_success "所有迁移执行成功！"
        echo ""
        echo "建议："
        echo "  1. 验证数据库表结构"
        echo "  2. 测试系统功能"
        echo "  3. 重启服务: docker compose restart"
    else
        print_error "部分迁移失败，请检查并修复后重试"
        exit 1
    fi
}

# 主函数
main() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  PIS 数据库迁移工具${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""
    
    check_container
    check_database
    run_migrations
}

# 运行主函数
main
