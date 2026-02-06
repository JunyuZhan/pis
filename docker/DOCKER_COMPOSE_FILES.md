# Docker Compose 文件说明

## 文件列表

| 文件 | 用途 | 说明 |
|------|------|------|
| `docker-compose.yml` | 生产环境配置（默认） | 包含所有基础服务，AI 服务已禁用 |
| `docker-compose.ai.yml` | AI 服务覆盖配置 | 用于启用 AI 服务，需与 `docker-compose.yml` 一起使用 |
| `docker-compose.dev.yml` | 开发环境配置 | 只包含基础服务（PostgreSQL、MinIO、Redis） |
| `start-with-ai.sh` | AI 服务启动脚本 | 一键启动包含 AI 服务的完整环境 |

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
