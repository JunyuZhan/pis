# 部署脚本环境配置自动生成逻辑报告

> 检查时间: 2026-02-06  
> 检查范围: `docker/deploy.sh` 及相关部署脚本

---

## 📋 执行摘要

**结论**: ✅ **部署脚本会自动生成环境配置文件**

部署脚本 `docker/deploy.sh` 具备完整的自动配置生成功能，包括：
- ✅ 自动生成安全密钥
- ✅ 自动创建 `.env` 配置文件
- ✅ 智能检测并替换默认值
- ⚠️ **未实现**: 从 `.env.example` 处理 `AUTO_GENERATE` 占位符

---

## 🔍 详细分析

### 1. 自动生成功能 ✅

#### 1.1 密钥生成函数

**位置**: `docker/deploy.sh:94-101`

```bash
generate_secret() {
    if command -v openssl &> /dev/null; then
        openssl rand -hex 32  # 生成 64 字符十六进制字符串
    else
        cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
    fi
}
```

**功能**:
- 优先使用 `openssl` 生成 64 字符十六进制随机字符串
- 回退到 `/dev/urandom` 生成 64 字符随机字符串
- 用于生成所有安全密钥

#### 1.2 自动生成的密钥列表

| 密钥名称 | 生成位置 | 生成方式 | 长度 |
|---------|---------|---------|------|
| `DATABASE_PASSWORD` | `configure_postgresql()` | `generate_secret \| cut -c1-32` | 32 字符 |
| `AUTH_JWT_SECRET` | `configure_postgresql()` | `generate_secret` | 64 字符 |
| `MINIO_ACCESS_KEY` | `configure_minio()` | `generate_secret \| cut -c1-16` | 16 字符 |
| `MINIO_SECRET_KEY` | `configure_minio()` | `generate_secret` | 64 字符 |
| `WORKER_API_KEY` | `configure_worker()` | `generate_secret` | 64 字符 |
| `ALBUM_SESSION_SECRET` | `configure_security()` | `generate_secret` | 64 字符 |
| `ADMIN_PASSWORD` | `create_admin_account()` | `generate_secret \| cut -c1-16` | 16 字符 |

---

### 2. 配置文件生成逻辑 ✅

#### 2.1 生成流程

**位置**: `docker/deploy.sh:392-541`

**流程**:

```
1. 检查现有 .env 文件
   ├─ 如果存在 → 检查是否使用默认值
   │   ├─ 检测到默认值 → 重新生成配置
   │   └─ 使用自定义值 → 保留现有配置
   └─ 如果不存在 → 生成新配置

2. 根据部署模式生成配置
   ├─ standalone (完全自托管)
   └─ hybrid (混合部署)

3. 写入 .env.generated 临时文件

4. 复制为 .env (项目根目录)
```

#### 2.2 默认值检测逻辑

**位置**: `docker/deploy.sh:400-443`

脚本会检测以下默认值：

| 变量 | 默认值检测 |
|------|-----------|
| `MINIO_ROOT_USER` | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | `minioadmin` |
| `DATABASE_PASSWORD` | `changeme`, `your-secure-password` |
| `POSTGRES_PASSWORD` | `changeme`, `your-secure-password` |
| `WORKER_API_KEY` | `changeme` |

**逻辑**:
- 如果检测到任何默认值，会显示警告并重新生成
- 如果使用自定义值，会保留现有配置

#### 2.3 配置文件内容

**完全自托管模式** (`standalone`):

```bash
# 域名配置
DOMAIN=$DOMAIN
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_MEDIA_URL=$MEDIA_URL
NEXT_PUBLIC_WORKER_URL=$WORKER_URL

# 数据库配置
DATABASE_TYPE=postgresql
DATABASE_HOST=$DATABASE_HOST
DATABASE_PORT=$DATABASE_PORT
DATABASE_NAME=$DATABASE_NAME
DATABASE_USER=$DATABASE_USER
DATABASE_PASSWORD=$DATABASE_PASSWORD  # 自动生成
DATABASE_SSL=false

# 认证配置
AUTH_MODE=custom
AUTH_JWT_SECRET=$AUTH_JWT_SECRET  # 自动生成

# MinIO 配置
MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY  # 自动生成
MINIO_SECRET_KEY=$MINIO_SECRET_KEY  # 自动生成
MINIO_BUCKET=$MINIO_BUCKET

# Worker 配置
WORKER_API_KEY=$WORKER_API_KEY  # 自动生成

# 安全配置
ALBUM_SESSION_SECRET=$ALBUM_SESSION_SECRET  # 自动生成

# 告警配置（可选）
ALERT_ENABLED=$ALERT_ENABLED
ALERT_TYPE=$ALERT_TYPE
# ... Telegram/Email 配置
```

---

### 3. 交互式配置流程 ✅

#### 3.1 配置步骤

脚本按以下顺序引导用户配置：

1. **检查 Docker 环境** (`check_docker`)
2. **配置部署架构** (`configure_deployment_mode`)
   - 完全自托管 vs 混合部署
3. **配置域名** (`configure_domain`)
4. **配置数据库** (`configure_postgresql` / `configure_supabase`)
   - 自动生成 `DATABASE_PASSWORD` 和 `AUTH_JWT_SECRET`
5. **配置 MinIO** (`configure_minio`)
   - 自动生成 `MINIO_ACCESS_KEY` 和 `MINIO_SECRET_KEY`
6. **配置 Worker** (`configure_worker`)
   - 自动生成 `WORKER_API_KEY`
7. **配置安全密钥** (`configure_security`)
   - 自动生成 `ALBUM_SESSION_SECRET`
8. **配置告警** (`configure_alerts`) - 可选
9. **生成配置** (`generate_config`)
10. **检查数据库初始化** (`check_and_init_database`)
11. **创建管理员账号** (`create_admin_account`)

#### 3.2 用户输入提示

所有密钥生成都有友好的提示：

```bash
# 示例：数据库密码
DATABASE_PASSWORD=$(get_input "数据库密码 (留空自动生成)" "")
if [ -z "$DATABASE_PASSWORD" ]; then
    DATABASE_PASSWORD=$(generate_secret | cut -c1-32)
    print_success "已自动生成数据库密码"
fi
```

---

### 4. `.env.example` 占位符处理功能 ✅ **已实现**

#### 4.1 功能实现

**状态**: ✅ **已完成** (2026-02-06)

**实现位置**: `docker/deploy.sh:103-130` (新增 `replace_placeholders` 函数)

**功能**:
- ✅ 检测 `.env.example` 文件是否存在
- ✅ 如果存在，复制作为配置模板
- ✅ 自动替换所有 `AUTO_GENERATE` 占位符
- ✅ 更新部署时收集的配置变量
- ✅ 保持向后兼容（如果没有 `.env.example`，使用原有逻辑）

#### 4.2 支持的占位符

| 占位符 | 替换内容 | 长度 |
|--------|---------|------|
| `AUTO_GENERATE_32` | 64 字符十六进制随机字符串 | 64 字符 |
| `AUTO_GENERATE_16` | 16 字符随机字符串 | 16 字符 |
| `AUTO_GENERATE` | 64 字符十六进制随机字符串 | 64 字符 |

#### 4.3 实现逻辑

```bash
# 1. 检测 .env.example
if [ -f "$PROJECT_ROOT/.env.example" ]; then
    cp "$env_example" "$env_file"
    replace_placeholders "$env_file"  # 替换占位符
    # 更新配置变量（域名、数据库等）
fi

# 2. replace_placeholders 函数
replace_placeholders() {
    # 替换 AUTO_GENERATE_32
    # 替换 AUTO_GENERATE_16
    # 替换 AUTO_GENERATE
    # 支持 macOS 和 Linux
}
```

#### 4.4 更新的配置变量

当使用 `.env.example` 作为模板时，脚本会自动更新以下变量：

- **域名配置**: `DOMAIN`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MEDIA_URL`, `NEXT_PUBLIC_WORKER_URL`
- **数据库配置** (standalone): `DATABASE_TYPE`, `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD`
- **认证配置**: `AUTH_MODE`, `AUTH_JWT_SECRET`
- **MinIO 配置**: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`
- **Worker 配置**: `WORKER_API_KEY`, `WORKER_URL`
- **安全配置**: `ALBUM_SESSION_SECRET`
- **告警配置**: `ALERT_ENABLED`, `ALERT_TYPE`, Telegram/Email 配置

#### 4.5 默认值检测增强

现在脚本还会检测占位符值：

- `AUTO_GENERATE_32` → 触发重新生成
- `AUTO_GENERATE` → 触发重新生成
- `AUTO_GENERATE_16` → 触发重新生成

---

### 5. 其他部署脚本

#### 5.1 `scripts/deploy/one-click-deploy.sh`

**功能**: 完全自动化部署（非交互式）

**特点**:
- ✅ 自动生成所有密钥
- ✅ 直接创建 `.env` 文件
- ✅ 无需用户交互

**生成逻辑**: 类似 `docker/deploy.sh`，但更简化

#### 5.2 `scripts/deploy/quick-deploy.sh`

**功能**: 快速部署脚本

**特点**:
- ✅ 自动生成密钥
- ✅ 检查现有配置
- ✅ 询问是否覆盖

---

## ✅ 总结

### 优点

1. ✅ **完整的自动生成功能**: 所有安全密钥都能自动生成
2. ✅ **智能检测**: 能检测并替换不安全的默认值
3. ✅ **用户友好**: 提供清晰的交互式引导
4. ✅ **安全性**: 使用加密安全的随机数生成器
5. ✅ **灵活性**: 支持用户自定义或自动生成

### 已完成的改进 ✅

1. ✅ **`.env.example` 占位符处理**: 已实现从 `.env.example` 读取并替换占位符
2. ✅ **文档一致性**: 文档说明与实际行为已一致

### 使用说明

**方式 1: 使用 .env.example 模板（推荐）**

```bash
# 1. 确保 .env.example 存在
# 2. 运行部署脚本
bash docker/deploy.sh

# 脚本会自动：
# - 检测 .env.example
# - 复制为模板
# - 替换所有 AUTO_GENERATE 占位符
# - 更新配置变量
```

**方式 2: 直接生成配置（向后兼容）**

如果没有 `.env.example`，脚本会使用原有逻辑直接生成配置。

---

## 📝 验证命令

```bash
# 测试密钥生成
cd docker
bash -c 'source deploy.sh; generate_secret'

# 检查配置生成逻辑
grep -n "generate_config\|AUTO_GENERATE" deploy.sh

# 查看 .env.example 中的占位符
grep "AUTO_GENERATE" ../.env.example
```

---

**报告生成时间**: 2026-02-06  
**检查脚本**: `docker/deploy.sh` (1287 行)
