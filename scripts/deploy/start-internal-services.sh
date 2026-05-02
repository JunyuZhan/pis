#!/bin/bash

# ============================================
# PIS 内网服务启动脚本
# 
# 用途：启动内网服务（适用于混合部署模式）
# - MinIO: 对象存储
# - Redis: 任务队列
# - PostgreSQL: 数据库（可选，如果使用完全自托管模式）
# 
# 部署模式：
# - 完全自托管模式：所有服务都在本地（PostgreSQL + MinIO + Redis + Web + Worker）
# - 混合部署模式：Web 在 Vercel，数据库在 Supabase（云端），Worker 在本地
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 打印函数
info() { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
step() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"

# 检测 Docker Compose 命令
detect_compose_cmd() {
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        error "未找到 Docker Compose"
        exit 1
    fi
    info "使用: $COMPOSE_CMD"
}

# 检查环境变量文件
check_env_file() {
    local env_file="$PROJECT_ROOT/.env"
    
    if [ ! -f "$env_file" ]; then
        error ".env 文件不存在: $env_file"
        echo ""
        echo "请先创建 .env 文件："
        echo "  1. 复制示例文件: cp .env.example .env"
        echo "  2. 或运行配置脚本: bash scripts/deploy/setup.sh"
        exit 1
    fi
    
    # 检查必需的 MinIO 环境变量
    local has_minio_key=false
    if grep -qE "^MINIO_ACCESS_KEY=|^STORAGE_ACCESS_KEY=" "$env_file" 2>/dev/null; then
        has_minio_key=true
    fi
    
    if [ "$has_minio_key" = false ]; then
        warn "未找到 MINIO_ACCESS_KEY 或 STORAGE_ACCESS_KEY"
        warn "MinIO 服务可能无法正常启动"
        echo ""
        echo "请在 .env 文件中添加以下配置之一："
        echo ""
        echo "  方式 1（旧格式）："
        echo "    MINIO_ACCESS_KEY=minioadmin"
        echo "    MINIO_SECRET_KEY=minioadmin"
        echo ""
        echo "  方式 2（新格式）："
        echo "    STORAGE_ACCESS_KEY=minioadmin"
        echo "    STORAGE_SECRET_KEY=minioadmin"
        echo ""
        warn "继续启动服务，但 MinIO 可能无法正常工作"
        echo ""
        read -p "按回车键继续..." dummy
    fi
}

# 检测 docker-compose 文件
detect_compose_file() {
    cd "$DOCKER_DIR"
    
    # 检查是否有激活的 docker-compose.yml
    if [ -f "docker-compose.yml" ]; then
        COMPOSE_FILE="docker-compose.yml"
        success "使用: docker-compose.yml"
    else
        error "未找到 docker-compose.yml 配置文件"
        exit 1
    fi
}

# 启动内网服务
start_internal_services() {
    step "启动内网服务"
    
    cd "$DOCKER_DIR"
    
    # 根据部署模式启动服务
    # 完全自托管模式：启动所有服务（包括 PostgreSQL）
    # 混合部署模式：只启动 MinIO 和 Redis
    info "启动内网服务..."
    
    # 检查是否使用完全自托管模式（检查是否有 docker-compose.yml）
    if [ -f "$DOCKER_DIR/docker-compose.yml" ]; then
        info "检测到完全自托管模式，启动所有服务..."
        $COMPOSE_CMD -f "$DOCKER_DIR/docker-compose.yml" up -d postgres minio redis
    else
        info "检测到混合部署模式，启动 MinIO 和 Redis..."
        $COMPOSE_CMD -f "$COMPOSE_FILE" up -d minio redis
    fi
    
    success "内网服务已启动"
}

# 检查服务状态
check_services() {
    step "检查服务状态"
    
    cd "$DOCKER_DIR"
    
    echo ""
    $COMPOSE_CMD -f "$COMPOSE_FILE" ps
    
    echo ""
    info "健康检查:"
    
    # 检查 MinIO
    echo -n "  MinIO: "
    if curl -s http://localhost:19000/minio/health/live > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
    
    # 检查 Redis
    echo -n "  Redis: "
    if docker exec pis-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
    
    # 检查 PostgreSQL（如果使用完全自托管模式）
    if docker ps --format '{{.Names}}' | grep -q "^pis-postgres$"; then
        echo -n "  PostgreSQL: "
        if docker exec pis-postgres pg_isready -U ${DATABASE_USER:-pis} -d ${DATABASE_NAME:-pis} > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    fi
}

# 显示服务信息
show_service_info() {
    step "服务访问信息"
    
    echo ""
    # 尝试从 .env 文件读取 MinIO 凭据
    local env_file="$PROJECT_ROOT/.env"
    local minio_user=""
    local minio_pass=""
    
    if [ -f "$env_file" ]; then
        # 读取 MINIO_ACCESS_KEY 或 STORAGE_ACCESS_KEY
        # 优先读取 MINIO_ACCESS_KEY，如果没有则读取 STORAGE_ACCESS_KEY
        minio_user=$(grep -E "^MINIO_ACCESS_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [ -z "$minio_user" ]; then
            minio_user=$(grep -E "^STORAGE_ACCESS_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        fi
        
        # 读取 MINIO_SECRET_KEY 或 STORAGE_SECRET_KEY
        # 优先读取 MINIO_SECRET_KEY，如果没有则读取 STORAGE_SECRET_KEY
        minio_pass=$(grep -E "^MINIO_SECRET_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [ -z "$minio_pass" ]; then
            minio_pass=$(grep -E "^STORAGE_SECRET_KEY=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        fi
        
        # 如果读取到的值包含变量引用（如 ${STORAGE_ACCESS_KEY}），尝试解析
        if [[ "$minio_user" =~ \$\{.*\} ]]; then
            # 提取变量名并重新读取
            local var_name=$(echo "$minio_user" | sed 's/\${\(.*\)}/\1/')
            minio_user=$(grep -E "^${var_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        fi
        if [[ "$minio_pass" =~ \$\{.*\} ]]; then
            local var_name=$(echo "$minio_pass" | sed 's/\${\(.*\)}/\1/')
            minio_pass=$(grep -E "^${var_name}=" "$env_file" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        fi
    fi
    
    echo -e "${GREEN}MinIO 控制台:${NC}"
    echo "  URL: http://localhost:19001"
    
    # 如果从 .env 文件读取失败，尝试从运行中的容器读取
    if [ -z "$minio_user" ] || [ -z "$minio_pass" ]; then
        if docker ps --format '{{.Names}}' | grep -q "^pis-minio$"; then
            info "尝试从运行中的容器读取 MinIO 凭据..."
            local container_user=$(docker exec pis-minio printenv MINIO_ROOT_USER 2>/dev/null || echo "")
            local container_pass=$(docker exec pis-minio printenv MINIO_ROOT_PASSWORD 2>/dev/null || echo "")
            if [ -n "$container_user" ]; then
                minio_user="$container_user"
            fi
            if [ -n "$container_pass" ]; then
                minio_pass="$container_pass"
            fi
        fi
    fi
    
    if [ -n "$minio_user" ] && [ -n "$minio_pass" ]; then
        echo "  用户名: $minio_user"
        echo "  密码: $minio_pass"
    elif [ -n "$minio_user" ]; then
        echo "  用户名: $minio_user"
        echo "  密码: 从 .env 文件查看 (MINIO_SECRET_KEY 或 STORAGE_SECRET_KEY)"
    elif [ -n "$minio_pass" ]; then
        echo "  用户名: 从 .env 文件查看 (MINIO_ACCESS_KEY 或 STORAGE_ACCESS_KEY)"
        echo "  密码: $minio_pass"
    else
        echo "  用户名: 从 .env 文件查看 (MINIO_ACCESS_KEY 或 STORAGE_ACCESS_KEY)"
        echo "  密码: 从 .env 文件查看 (MINIO_SECRET_KEY 或 STORAGE_SECRET_KEY)"
        echo ""
        warn "提示: 如果 MinIO 服务已启动，凭据可能已在容器中配置"
        warn "      请检查 .env 文件或查看容器环境变量"
    fi
    echo ""
    
    echo -e "${GREEN}MinIO API:${NC}"
    echo "  URL: http://localhost:19000"
    echo ""
    
    echo -e "${GREEN}Redis:${NC}"
    echo "  端口: 16379 (仅本地)"
    echo ""
    
    echo -e "${YELLOW}提示:${NC}"
    echo "  - 这些服务仅在内网访问（127.0.0.1）"
    echo "  - 完全自托管模式：所有服务都在本地（PostgreSQL + MinIO + Redis + Web + Worker）"
    echo "  - 混合部署模式：Web 在 Vercel，数据库在 Supabase（云端），Worker 在本地"
    echo "  - Worker 服务可通过 docker compose up -d worker 启动"
    echo ""
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   📸 PIS - 内网服务启动脚本                                ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    
    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装"
        exit 1
    fi
    
    # 检查环境变量文件
    check_env_file
    
    # 检测 Compose 命令
    detect_compose_cmd
    
    # 检测 compose 文件
    detect_compose_file
    
    # 启动服务
    start_internal_services
    
    # 等待服务启动
    info "等待服务启动..."
    sleep 8
    
    # 检查服务状态
    check_services
    
    # 显示服务信息
    show_service_info
    
    success "完成！"
}

# 运行主函数
main
