# 部署脚本

本目录包含所有部署相关的脚本。

## 📋 脚本分类

### 🚀 一键部署脚本（推荐）

| 脚本 | 描述 | 使用场景 | 用法 |
|------|------|---------|------|
| `one-click-deploy.sh` | **真正的一键部署**（完全自动化） | 快速部署，无需交互 | `curl -sSL <URL> \| bash` |
| `deploy.sh` | 一键部署（支持本地/远程） | 服务器部署，支持远程 | `bash scripts/deploy/deploy.sh [IP]` |

### ⚙️ 配置和管理脚本

| 脚本 | 描述 | 使用场景 | 用法 |
|------|------|---------|------|
| `setup.sh` | 引导式配置脚本（交互式菜单） | 本地开发环境设置 | `bash scripts/deploy/setup.sh` |
| `quick-deploy.sh` | 快速部署（生成配置，不管理容器） | 只生成配置文件 | `bash scripts/deploy/quick-deploy.sh` |
| `quick-upgrade.sh` | 快速升级（更新代码，不管理容器） | 只更新代码和配置 | `bash scripts/deploy/quick-upgrade.sh` |

### 🔧 服务管理脚本

| 脚本 | 描述 | 使用场景 | 用法 |
|------|------|---------|------|
| `start-internal-services.sh` | 只启动内网服务（MinIO、Redis、数据库） | 开发环境，只需要存储服务 | `bash scripts/deploy/start-internal-services.sh` |
| `update-worker-on-server.sh` | 更新 Worker 服务 | 更新 Worker 镜像 | `bash scripts/deploy/update-worker-on-server.sh` |
| `verify-deployment.sh` | 验证部署是否成功 | 部署后验证 | `bash scripts/deploy/verify-deployment.sh` |

---

## 🚀 快速开始

### 方法一：一键部署（推荐新手）

**完全自动化部署**（无需任何配置）：

```bash
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash
```

**引导式部署**（需要交互配置）：

```bash
git clone https://github.com/JunyuZhan/pis.git
cd pis/docker
bash deploy.sh
```

### 方法二：本地部署到远程服务器

```bash
bash scripts/deploy/deploy.sh <服务器IP> [用户名]
```

### 方法三：本地开发环境设置

```bash
# 引导式设置（交互式菜单）
bash scripts/deploy/setup.sh

# 只启动内网服务（MinIO、Redis、数据库）
bash scripts/deploy/start-internal-services.sh
```

---

## 📖 脚本详细说明

### 1. `one-click-deploy.sh` - 真正的一键部署 ⭐

**特点：**
- ✅ 完全自动化，无需交互
- ✅ 自动安装 Docker 和 Docker Compose
- ✅ 自动克隆代码（如果不在项目目录）
- ✅ 自动生成所有密钥和密码
- ✅ 自动启动所有服务
- ✅ 自动创建管理员账户

**使用场景：**
- 快速测试部署
- 演示环境部署
- 不需要自定义配置的场景

**用法：**
```bash
# 从 GitHub 直接运行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash

# 或在项目目录中运行
bash scripts/deploy/one-click-deploy.sh
```

---

### 2. `deploy.sh` - 一键部署脚本（功能完整）

**特点：**
- ✅ 支持本地和远程部署
- ✅ 自动安装 Docker 和 Docker Compose
- ✅ 支持非交互式模式（环境变量）
- ✅ 多种构建策略

**使用场景：**
- 服务器上快速部署
- CI/CD 自动化部署
- 远程服务器部署

**用法：**
```bash
# 在服务器上直接运行
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/deploy.sh | bash

# 在本地运行，远程部署
bash scripts/deploy/deploy.sh <服务器IP> [用户名]
```

---

### 4. `setup.sh` - 引导式配置脚本

**特点：**
- ✅ 交互式菜单
- ✅ 本地开发环境设置
- ✅ 生产环境部署配置
- ✅ Docker 服务管理

**使用场景：**
- 本地开发环境设置
- 需要交互式配置
- 管理 Docker 服务

**用法：**
```bash
bash scripts/deploy/setup.sh
```

---

### 5. `quick-deploy.sh` - 快速部署（只生成配置）

**特点：**
- ✅ 快速生成配置文件
- ✅ 不管理服务器上的容器
- ✅ 支持自定义 MinIO 密钥

**使用场景：**
- 只生成配置文件
- 不启动容器
- 配置后手动启动容器

**用法：**
```bash
bash scripts/deploy/quick-deploy.sh
bash scripts/deploy/quick-deploy.sh --minio-user albert --minio-pass Zjy-1314
```

---

### 6. `quick-upgrade.sh` - 快速升级（只更新代码）

**特点：**
- ✅ 拉取最新代码
- ✅ 更新配置文件
- ✅ 不管理服务器上的容器

**使用场景：**
- 升级代码和配置
- 不重启容器
- 配置后手动重启容器

**用法：**
```bash
bash scripts/deploy/quick-upgrade.sh
bash scripts/deploy/quick-upgrade.sh --force
```

---

### 7. `start-internal-services.sh` - 启动内网服务

**特点：**
- ✅ 只启动基础服务（MinIO、Redis、数据库）
- ✅ 不启动 Worker 和 Web 服务
- ✅ 自动检测 docker-compose 配置

**使用场景：**
- 本地开发时只需要存储和数据库服务
- 测试环境只需要基础服务

**用法：**
```bash
bash scripts/deploy/start-internal-services.sh
```

---

### 8. `update-worker-on-server.sh` - 更新 Worker 服务

**特点：**
- ✅ 拉取最新代码（可选）
- ✅ 更新环境配置
- ✅ 重新构建 Worker 镜像
- ✅ 重启 Worker 服务

**使用场景：**
- 更新 Worker 服务
- 应用代码更新

**用法：**
```bash
bash scripts/deploy/update-worker-on-server.sh
```

---

### 9. `verify-deployment.sh` - 验证部署

**特点：**
- ✅ 端到端验证部署是否成功
- ✅ 检查所有服务状态
- ✅ 测试 API 端点

**使用场景：**
- 部署后验证
- 故障排查

**用法：**
```bash
bash scripts/deploy/verify-deployment.sh [SSH_HOST]
```

---

## 🎯 选择指南

### 我需要什么脚本？

| 场景 | 推荐脚本 | 说明 |
|------|---------|------|
| **首次部署，完全自动化** | `one-click-deploy.sh` | 无需任何配置，一键完成 |
| **首次部署，需要配置** | `docker/deploy.sh` | 引导式配置，适合新手 |
| **服务器快速部署** | `deploy.sh` | 功能完整，支持远程 |
| **本地开发环境** | `setup.sh` | 交互式菜单，灵活配置 |
| **只生成配置** | `quick-deploy.sh` | 不管理容器，只生成配置 |
| **只更新代码** | `quick-upgrade.sh` | 不管理容器，只更新代码 |
| **只启动存储服务** | `start-internal-services.sh` | 轻量级，适合开发 |
| **更新 Worker** | `update-worker-on-server.sh` | 更新 Worker 服务 |
| **验证部署** | `verify-deployment.sh` | 检查部署是否成功 |

---

## 📚 相关文档

- [部署脚本详细说明](./DEPLOYMENT_SCRIPTS.md) - 详细的脚本功能说明
- [快速部署指南](./QUICK_GUIDE.md) - 快速部署步骤
- [部署指南](../docs/i18n/zh-CN/DEPLOYMENT.md) - 完整部署文档
- [部署指南 (English)](../docs/i18n/en/DEPLOYMENT.md) - Deployment guide

---

## 🔧 Docker Compose 配置文件

项目以 **`docker/docker-compose.yml`** 为**唯一**编排（仅拉取预构建镜像）。部署时复制 **`docker/env.deploy.example`** 为 **`docker/.env`** 并填写后，在 `docker/` 目录执行 `docker compose pull && docker compose up -d`；也可用 **`docker/start-from-registry.sh`**。

---

## ⚠️ 注意事项

1. **环境变量**：所有脚本都使用根目录的 `.env` 文件进行配置
2. **Docker 权限**：确保当前用户有 Docker 执行权限
3. **端口冲突**：确保所需端口未被占用
4. **网络访问**：确保可以访问 Docker Hub（拉取镜像）

---

## 🆘 遇到问题？

1. 查看脚本日志输出
2. 检查 Docker 服务状态：`docker ps`
3. 查看服务日志：`docker-compose logs -f`
4. 参考 [部署文档](../docs/i18n/zh-CN/DEPLOYMENT.md)
