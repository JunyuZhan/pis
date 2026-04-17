# Docker Compose 文件说明

## 文件列表

| 文件 | 用途 | 说明 |
|------|------|------|
| `docker-compose.yml` | 生产环境配置（默认） | 包含所有基础服务，AI 服务已禁用 |
| `docker-compose.ai.yml` | AI 服务覆盖配置 | 用于启用 AI 服务，需与 `docker-compose.yml` 一起使用 |
| `docker-compose.dev.yml` | 开发环境配置 | 只包含基础服务（PostgreSQL、MinIO、Redis） |
| `docker-compose.registry.yml` | 私有镜像覆盖 | 为 `web` / `worker` 指定仓库镜像，与主 compose 叠加；需配合 `--no-build` 或 `start-from-registry.sh` |
| `docker-compose.customer.yml` | 客户单文件入口 | `include` 合并 `docker-compose.yml` + `docker-compose.registry.yml`；客户只需 `-f` 此文件（需 Compose v2.20+） |
| `docker-compose.customer-secrets.yml` | 客户单文件入口（Secrets） | 同上，合并 `docker-compose.secrets.yml` + `docker-compose.registry.yml` |
| `start-with-ai.sh` | AI 服务启动脚本 | 一键启动包含 AI 服务的完整环境 |
| `start-from-registry.sh` | 私有镜像启动 | `pull` web/worker 后以 `--no-build` 启动，避免走本地 `build` |
| `push-images-to-registries.sh` | 多 Registry 构建推送 | 在**仓库根目录**一次构建、`docker push` 到私有与 Docker Hub 等（见下文「多 Registry 推送」） |

## 使用方法

### 标准启动（不包含 AI 服务）

```bash
cd docker
docker compose -f docker-compose.yml up -d
```

或使用部署脚本：

```bash
bash docker/deploy.sh
```

### 启动包含 AI 服务

```bash
cd docker
bash start-with-ai.sh
```

或手动使用 Docker Compose：

```bash
cd docker
docker compose -f docker-compose.yml -f docker-compose.ai.yml up -d
```

### 开发环境启动

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d
```

### 私有 Docker 镜像仓库（生产机只拉镜像、不构建）

1. 在 CI 或构建机构建并推送镜像（示例标签请按版本修改；**构建上下文为仓库根目录**，与 Dockerfile 中 `COPY` 路径一致）：

   ```bash
   cd /path/to/pis   # 仓库根目录
   docker build -f docker/web.Dockerfile -t hub.albertzhan.top/pis/web:1.1.0 .
   docker build -f docker/worker.Dockerfile -t hub.albertzhan.top/pis/worker:1.1.0 .
   docker push hub.albertzhan.top/pis/web:1.1.0
   docker push hub.albertzhan.top/pis/worker:1.1.0
   ```

#### 多 Registry 推送（私有仓库 + Docker Hub）

同一镜像可打多个全名标签后分别 `push`（digest 一致）。部署机 `.env` 里 **`PIS_WEB_IMAGE` / `PIS_WORKER_IMAGE` 仍只写一套**（按环境选私有或 Hub）。

**推荐：使用脚本（在仓库根目录执行）**

推送前在构建机对**每个**要推送的 Registry 执行 `docker login`（私有域与 Docker Hub 分开登录）。

```bash
cd /path/to/pis
export PIS_IMAGE_TAG=1.1.0
# 可选：覆盖默认私有仓库路径（不含 tag）
# export PIS_PRIVATE_WEB_IMAGE=registry.example.com/pis/web
# export PIS_PRIVATE_WORKER_IMAGE=registry.example.com/pis/worker
# 若需同时推 Docker Hub，设置 Hub 上仓库全名（不含 tag；Docker Hub 常用两仓库 pis-web / pis-worker）
export PIS_DOCKERHUB_WEB_IMAGE=docker.io/<你的DockerHub用户名>/pis-web
export PIS_DOCKERHUB_WORKER_IMAGE=docker.io/<你的DockerHub用户名>/pis-worker

bash docker/push-images-to-registries.sh
```

不设 `PIS_DOCKERHUB_*` 时，脚本行为与仅推私有仓库一致。

**手动等价（二次 `docker tag` + `docker push`）**

```bash
cd /path/to/pis
TAG=1.1.0
docker build -f docker/web.Dockerfile -t hub.albertzhan.top/pis/web:${TAG} .
docker tag hub.albertzhan.top/pis/web:${TAG} docker.io/<你的DockerHub用户名>/pis-web:${TAG}
docker push hub.albertzhan.top/pis/web:${TAG}
docker push docker.io/<你的DockerHub用户名>/pis-web:${TAG}

docker build -f docker/worker.Dockerfile -t hub.albertzhan.top/pis/worker:${TAG} .
docker tag hub.albertzhan.top/pis/worker:${TAG} docker.io/<你的DockerHub用户名>/pis-worker:${TAG}
docker push hub.albertzhan.top/pis/worker:${TAG}
docker push docker.io/<你的DockerHub用户名>/pis-worker:${TAG}
```

2. 在部署机登录**实际拉取镜像**的 Registry，例如私有：`docker login hub.albertzhan.top`；若 `.env` 指向 Docker Hub：`docker login`（或 `docker login docker.io`）

3. 在项目根目录 `.env` 中设置镜像全名（含标签），**只填实际拉取来源**（私有或 Docker Hub 二选一），例如：

   ```bash
   # 私有仓库示例
   PIS_WEB_IMAGE=hub.albertzhan.top/pis/web:1.1.0
   PIS_WORKER_IMAGE=hub.albertzhan.top/pis/worker:1.1.0
   # Docker Hub 示例（仓库名按你在 Hub 上创建的为准）
   # PIS_WEB_IMAGE=docker.io/<你的DockerHub用户名>/pis-web:1.1.0
   # PIS_WORKER_IMAGE=docker.io/<你的DockerHub用户名>/pis-worker:1.1.0
   ```

4. 启动（推荐脚本，已包含 `pull` 与 `--no-build`）：

   ```bash
   cd docker
   bash start-from-registry.sh
   ```

   使用 Docker Secrets 生产配置时：

   ```bash
   cd docker
   bash start-from-registry.sh --secrets
   ```

   客户若希望**只指定一个 Compose 文件**（类似单文件 `version` + `services` 的用法），可直接使用合并入口（需 Docker Compose **v2.20+**，且支持 `include` 的 `path` 列表）：

   ```bash
   cd docker
   docker compose -f docker-compose.customer.yml pull web worker
   docker compose -f docker-compose.customer.yml up -d --no-build
   ```

   Secrets 版：

   ```bash
   cd docker
   docker compose -f docker-compose.customer-secrets.yml pull web worker
   docker compose -f docker-compose.customer-secrets.yml up -d --no-build
   ```

   手动等价命令（**必须**带 `--no-build**，否则 compose 仍可能执行本地 `build`）：

   ```bash
   cd docker
   docker compose -f docker-compose.yml -f docker-compose.registry.yml pull web worker
   docker compose -f docker-compose.yml -f docker-compose.registry.yml up -d --no-build
   ```

### 仅镜像交付（不向客户提供应用源码）

若商业或内网场景**只提供已构建的 `web` / `worker` 镜像**（例如推送到私有仓库与/或 Docker Hub），客户机上**不需要** `apps/`、`services/` 等源码树；仍需要一份 **部署包**：与容器编排、数据库初始化、反向代理相关的文件，以及由客户填写的环境变量。

**推荐宿主机目录布局**（与当前 compose 中 `env_file: ../.env`、`web` 挂载「`docker` 的上一级」为项目根的习惯一致）：

```text
/opt/pis/
  .env                 # 客户根据你们提供的说明填写密钥与域名等
  docker/              # 部署包内容：与仓库中 `docker/` 目录一致（见下）
    docker-compose.yml
    docker-compose.registry.yml
    docker-compose.customer.yml           # 客户单 -f 入口（合并上两者）
    docker-compose.customer-secrets.yml    # Secrets 场景单 -f 入口
    docker-compose.secrets.yml    # 若走 Secrets 生产配置
    start-from-registry.sh
    nginx/
    init-postgresql-db.sql
    init-postgresql.sh
    migrations/
    run-migrations.sh
    secrets/                        # Secrets 流程时配合 DEPLOY-SECURE.md
    …                               # 以及 compose 里 bind mount 引用的其他路径
```

**部署包中应包含的要点**（随版本发布打成一个压缩包或安装介质即可）：

| 类别 | 说明 |
|------|------|
| Compose 与脚本 | `docker-compose.yml`、`docker-compose.registry.yml`；客户单入口 `docker-compose.customer.yml` / `docker-compose.customer-secrets.yml`；生产可选 `docker-compose.secrets.yml`；`start-from-registry.sh`；按需 `DEPLOY-SECURE.md`、`deploy.sh` 等 |
| 反向代理与 TLS | `nginx/` 下被挂载的配置与证书路径 |
| 数据库 | `init-postgresql-db.sql`、`init-postgresql.sh`；升级用的 `migrations/`、`run-migrations.sh` |
| 环境变量 | 根目录 `.env` 模板与填写说明（可不包含真实密钥） |

**客户侧运行方式**：配置 `PIS_WEB_IMAGE` / `PIS_WORKER_IMAGE`（或默认值）后，在 `docker/` 目录执行 `bash start-from-registry.sh`（或 `--secrets`），见上文「私有 Docker 镜像仓库」。

**版本升级（无源码时）**：由你们在仓库中构建新 tag 并 `push`；客户在部署机更新 `.env` 中的镜像 tag（或固定 `latest` 由运维控制），执行 `docker compose ... pull web worker` 与 `... up -d --no-build`（或直接再跑 `start-from-registry.sh`）。

**与「带源码部署」的差异**：管理后台中与**宿主机 Git / `scripts/deploy/quick-upgrade.sh`** 相关的「一键升级」能力，依赖挂载目录内存在对应脚本与仓库；**仅镜像且部署包不含这些脚本时，该路径不可用**，应以上述「拉取新镜像 + 重启」作为正式升级流程。

## 文件说明

> PIS 项目包含多个 Docker Compose 配置文件，用于不同的部署场景

## 📋 文件列表

### 1. `docker-compose.yml` ⭐ **生产环境推荐**

**用途**: 完全自托管部署（生产环境 - 多端口模式）

**包含服务**:
- PostgreSQL - 数据库
- MinIO - 对象存储
- Redis - 任务队列/缓存
- Worker - 图片处理服务
- Web - Next.js 前端（集成代理功能）

**特点**:
- ✅ 多端口模式，所有服务端口直接暴露
- ✅ 数据库自动初始化（首次启动时）
- ✅ 包含所有必需的服务
- ✅ 适合生产环境部署
- ✅ 推荐用于生产部署

**使用方法**:
```bash
cd docker
docker-compose up -d
```

---

### 2. `docker-compose.dev.yml` 🔧 **开发环境**

**用途**: 开发环境基础服务（仅存储和数据库）

**包含服务**:
- PostgreSQL - 数据库
- MinIO - 对象存储
- Redis - 任务队列/缓存

**特点**:
- ✅ 仅包含基础服务
- ✅ Web 和 Worker 在本地运行（无需容器）
- ✅ 适合本地开发

**使用方法**:
```bash
cd docker
docker-compose -f docker-compose.dev.yml up -d
```

---

## 🎯 选择指南

### 场景 1: 生产环境部署（推荐）

**使用**: `docker-compose.yml`

**适用场景**:
- 生产环境部署
- 所有服务都在本地服务器
- 需要完全控制所有组件
- 内网部署或私有云部署

**优点**:
- 所有服务端口直接暴露，便于访问和管理
- 数据完全私有
- 无需外部依赖
- 统一管理

---

### 场景 2: 开发环境

**使用**: `docker-compose.dev.yml`

**适用场景**:
- 本地开发
- Web 和 Worker 在本地运行
- 只需要存储和数据库服务

**优点**:
- 轻量级
- 快速启动
- 适合本地开发

---

## 🔄 数据库初始化

### 自动初始化（推荐）

以下配置文件支持自动数据库初始化：
- ✅ `docker-compose.yml` - 自动初始化（生产环境）
- ✅ `docker-compose.dev.yml` - 自动初始化（开发环境）

**说明**: PostgreSQL 容器会在首次启动时自动执行 `init-postgresql-db.sql`

### 手动初始化

如果使用外部数据库或数据卷已存在：

```bash
# 外部 PostgreSQL
psql -U pis -d pis -f docker/init-postgresql-db.sql

# Docker 容器内执行
docker exec -i pis-postgres psql -U pis -d pis < docker/init-postgresql-db.sql
```

---

## 📊 对比表

| 特性 | docker-compose.yml (生产) | docker-compose.dev.yml (开发) |
|------|------------------------|---------------------------|
| PostgreSQL | ✅ (自动初始化) | ✅ (自动初始化) |
| MinIO | ✅ | ✅ |
| Redis | ✅ | ✅ |
| Worker | ✅ (端口 3001) | ❌ (本地运行) |
| Web | ✅ (端口 8081) | ❌ (本地运行) |
| 端口模式 | 多端口（所有服务暴露） | 多端口（基础服务） |
| 推荐度 | ⭐⭐⭐⭐⭐ (生产) | ⭐⭐⭐⭐ (开发) |

---

## 🚀 快速开始

### 生产环境部署（推荐）

```bash
cd docker
docker-compose up -d
```

### 开发环境

```bash
cd docker
docker-compose -f docker-compose.dev.yml up -d
```

---

## 📝 注意事项

1. **数据库初始化**: `docker-compose.yml` 和 `docker-compose.dev.yml` 支持自动初始化
2. **环境变量**: 所有配置文件都使用根目录的 `.env` 文件
3. **数据卷**: 不同配置文件使用不同的数据卷名称
4. **推荐配置**: 
   - 生产环境：使用 `docker-compose.yml`（多端口模式，所有服务暴露）
   - 开发环境：使用 `docker-compose.dev.yml`（基础服务，Web 和 Worker 本地运行）

---

## 🔗 相关文档

- [Docker 部署指南](./README.md)
- [存储卷管理](./VOLUMES.md)
- [环境变量配置](../docs/ENVIRONMENT_VARIABLES.md)
