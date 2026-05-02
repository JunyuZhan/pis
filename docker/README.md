# PIS Docker 部署指南

> 📋 **编排与目录**：见 [DOCKER_COMPOSE_FILES.md](./DOCKER_COMPOSE_FILES.md)。

### 向部署者提供什么

提供 **`docker/` 目录**（`docker-compose.yml`、`nginx/`、`init-postgresql-db.sql` 等）。**Compose 无 `build:`、无 `env_file:`**；Postgres 服务仅保留 **`environment.POSTGRES_HOST_AUTH_METHOD=trust` 一行**（Docker Library 在空数据卷上的 entrypoint 硬性要求；`postgres -c hostauth=trust` 不是有效 GUC，无法替代）。其余业务配置（JWT、MinIO、管理员等）均在 **Web/Worker 代码** 中自闭环。MinIO 使用官方镜像 + **`command: server /data --console-address :9001`**。

在 **`docker/`** 目录部署执行：

```bash
docker compose pull
docker compose up -d
```

**不需要**在服务器上 `docker build` 应用镜像；`web` / `worker` 的 `image:` 按需改成你们的 Registry 地址即可。

**构建端推镜像**：在仓库根目录执行 `bash docker/push-images-to-registries.sh`（见 [DOCKER_COMPOSE_FILES.md](./DOCKER_COMPOSE_FILES.md)）。也可在 `docker/` 下执行 `bash start-from-registry.sh`（等价于 pull + up）。

**说明**：内网 DNS 为 compose **服务名**：`postgres`、`minio`、`redis`。进库示例：`cd docker && docker compose exec postgres psql -U postgres -d postgres`。本地 `pnpm dev` 仍可用仓库根目录 `.env` 覆盖连接串。

## 部署架构

**完全自托管（推荐）**

| 组件 | 位置 | 说明 |
|------|------|------|
| **前端** | 自建服务器 | Next.js 应用（Docker 容器） |
| **数据库** | 自建服务器 | PostgreSQL 数据库（Docker 容器，自动初始化） |
| **存储/Worker** | 自建服务器 | MinIO + Redis + Worker 服务（Docker 容器） |
| **反向代理** | 自建服务器 | Next.js Web 容器（集成代理功能） |

**混合部署（可选，向后兼容）**

| 组件 | 位置 | 说明 |
|------|------|------|
| **前端** | Vercel | Next.js 应用（自动部署） |
| **数据库** | Supabase Cloud | PostgreSQL 数据库和认证（向后兼容） |
| **存储/Worker** | 自建服务器 | MinIO + Redis + Worker 服务 |

## 快速开始（一键部署）

以下「克隆仓库」方式面向**仓库中含应用源码**的部署。若运行环境**只拉 Registry 镜像、不带完整源码树**，请跳过本节的 curl / `git clone`，按 [DOCKER_COMPOSE_FILES.md](./DOCKER_COMPOSE_FILES.md) 准备 `docker-compose.yml` 与同目录下的 `nginx/`、初始化 SQL 脚本后执行 `docker compose up`。

### 方法一：完全自动化部署（推荐）

```bash
# 一键部署，无需任何配置
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash
```

此脚本会自动完成：
- ✅ 安装 Docker 和 Docker Compose（如果未安装）
- ✅ 克隆代码（如果不在项目目录）
- ✅ 生成所有配置文件和安全密钥
- ✅ 启动所有服务
- ✅ 创建管理员账户

### 方法二：交互式配置部署

```bash
# 克隆代码并运行交互式配置向导
git clone https://github.com/JunyuZhan/pis.git
cd pis/docker
bash deploy.sh
```

`deploy.sh` 会引导你完成：配置数据库连接、域名与 SSL、存储与密钥、Worker、初始化数据库与管理员账号等。

### 方法三：人脸识别（AI）

标准 **`docker-compose.yml`** 为「仅预构建镜像」部署，**不包含 AI 容器**。运行 `bash start-with-ai.sh` 会提示说明；需要 AI 时请使用源码仓库在开发机构建或等待独立镜像方案。

## 手动部署

### 使用私有镜像仓库（不在服务器上构建 Web / Worker）

若已将 `web`、`worker` 镜像推送到私有仓库、Docker Hub 或其它 Registry，在运行环境登录对应 Registry 后执行（脚本内带默认镜像名，可按需在 shell 中 `export PIS_WEB_IMAGE=...` 覆盖）：

```bash
cd docker
bash start-from-registry.sh
```

说明与命令细节见 [DOCKER_COMPOSE_FILES.md](./DOCKER_COMPOSE_FILES.md)。

### 1. 配置数据库

#### 方式一：使用 Docker Compose（推荐）

使用 `docker-compose.yml` 自动启动 PostgreSQL：

```bash
cd docker
docker-compose -f docker-compose.yml up -d postgres
```

#### 方式二：使用外部 PostgreSQL

确保 PostgreSQL 已安装并运行，然后执行初始化脚本：

```bash
psql -h localhost -U postgres -d pis -f docker/init-postgresql-db.sql
```

### 2. 配置环境变量

```bash
# 复制并编辑配置文件
cp ../.env.example ../.env
nano ../.env

# 必须配置:
#   DATABASE_TYPE=postgresql
#   DATABASE_HOST=localhost
#   DATABASE_PORT=5432
#   DATABASE_NAME=pis
#   DATABASE_USER=pis
#   DATABASE_PASSWORD=your-secure-password
#   AUTH_JWT_SECRET=your-jwt-secret-key-at-least-32-characters-long
```

### 3. 初始化数据库

#### 自动初始化（推荐）

**Docker Compose 会自动初始化数据库**：
- ✅ PostgreSQL 容器会在首次启动时自动执行 `init-postgresql-db.sql`
- ✅ 如果数据卷是全新的，无需手动操作
- ✅ 数据库会在容器启动后自动完成初始化

#### 手动初始化（外部数据库或已有数据卷）

如果使用外部 PostgreSQL 或数据卷已存在，需要手动执行：

```bash
# 外部 PostgreSQL
psql -h localhost -U postgres -d postgres -f docker/init-postgresql-db.sql

# 或使用 Docker 容器执行（仓库根目录）
docker compose -f docker/docker-compose.yml exec -T postgres psql -U postgres -d postgres < docker/init-postgresql-db.sql
```

### 4. 创建管理员账号

```bash
# 使用脚本创建管理员账号
cd ..
pnpm create-admin

# 或直接运行
pnpm exec tsx scripts/utils/create-admin.ts
```

### 5. 启动服务

#### 完全自托管模式（推荐）

```bash
cd docker
docker-compose -f docker-compose.yml up -d
```

这将启动所有服务：PostgreSQL、MinIO、Redis、Worker、Web、Nginx。

#### 混合部署模式（仅 Worker 和存储，向后兼容）

```bash
cd docker
docker-compose up -d
```

然后单独部署前端到 Vercel：
- 导入 GitHub 仓库到 Vercel
- 配置环境变量（从 .env 文件）
- 部署

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f worker

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| nginx | 8081 | 反向代理（唯一对外暴露端口，所有服务通过路径访问） |
| web | 容器内 | Next.js 前端（通过 Nginx 访问） |
| worker | 容器内 | 图片处理服务（通过 Nginx /worker-api/ 访问） |
| postgres | 容器内 | PostgreSQL 数据库（仅容器内访问） |
| minio | 容器内 | 对象存储（通过 Nginx /media/ 和 /minio-console/ 访问） |
| redis | 容器内 | 任务队列（仅容器内访问） |

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose logs --tail=100 <服务名>

# 检查容器状态
docker compose ps -a
```

### 数据库连接失败

检查 PostgreSQL 配置：
- 确认 `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_NAME`、`DATABASE_USER`、`DATABASE_PASSWORD` 正确
- 检查 PostgreSQL 服务是否运行：`docker-compose ps postgres`
- 检查数据库是否已初始化：`psql -h localhost -U postgres -d postgres -c "\dt"`

### MinIO 无法访问

```bash
# 检查 MinIO 健康状态
curl http://localhost:9000/minio/health/live
```

## 备份与恢复

### 备份数据

```bash
# 备份 MinIO 数据（存储的图片文件）
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar czf /backup/minio-backup.tar.gz /data

# 数据库备份（PostgreSQL）
# 完全自托管模式：
docker compose -f docker/docker-compose.yml exec -T postgres pg_dump -U postgres -d postgres > backup.sql

# 混合部署模式（Supabase）：在 Supabase Dashboard -> Database -> Backups 中操作
```

### 恢复数据

```bash
# 恢复 MinIO 数据
docker run --rm -v pis_minio_data:/data -v $(pwd):/backup alpine tar xzf /backup/minio-backup.tar.gz -C /

# 恢复 PostgreSQL 数据（plain SQL 备份）
docker compose -f docker/docker-compose.yml exec -T postgres psql -U postgres -d postgres < backup.sql

# 或宿主机直连
psql -h localhost -U postgres -d postgres < backup.sql
```
