# PIS 安全部署指南（Docker Secrets）

本指南介绍如何使用 Docker Secrets 安全部署 PIS 生产环境。

## 为什么使用 Docker Secrets？

| 方式 | `docker inspect` | 进程列表 | 安全性 | 适用场景 |
|------|-----------------|---------|--------|----------|
| **Docker Secrets** | ✅ 不可见 | ✅ 不可见 | ⭐⭐⭐⭐⭐ 高 | **生产环境** |
| 环境变量 | ❌ 可见 | ❌ 可见 | ⭐⭐ 较低 | 开发/测试环境 |

## 快速部署

```bash
# 1. 进入项目目录
cd /opt/pis

# 2. 初始化密钥（首次部署）
cd docker/secrets
./init-secrets.sh
cd ../..

# 3. 启动服务
docker compose -f docker/docker-compose.secrets.yml up -d
```

## 密钥文件说明

初始化后，`docker/secrets/` 目录包含以下文件：

| 文件 | 用途 | 必需 | 说明 |
|------|------|------|------|
| `db_password` | PostgreSQL 密码 | ✅ | 数据库连接 |
| `jwt_secret` | JWT 签名密钥 | ✅ | 用户认证 |
| `minio_access_key` | MinIO 用户名 | ✅ | 对象存储访问 |
| `minio_secret_key` | MinIO 密码 | ✅ | 对象存储访问 |
| `worker_api_key` | Worker API 密钥 | ✅ | 内部服务通信 |
| `album_session_secret` | 相册会话密钥 | ✅ | 客户端会话 |
| `redis_password` | Redis 密码 | 可选 | 缓存服务 |
| `cloudflare_api_token` | Cloudflare Token | 可选 | CDN 缓存清除 |
| `cloudflare_zone_id` | Cloudflare Zone ID | 可选 | CDN 缓存清除 |

## 验证安全性

```bash
# 尝试查看容器环境变量 - 不应看到密码
docker inspect pis-web | grep -A 50 '"Env"'
docker inspect pis-worker | grep -A 50 '"Env"'

# 密钥只存在于 /run/secrets/ 目录中（容器内）
docker exec pis-web ls -la /run/secrets/
docker exec pis-worker ls -la /run/secrets/
```

## FTP 上传配置

**重要**：FTP 账号不是系统级密钥，由应用层管理！

### 每个相册独立的 FTP 账号

PIS 为每个相册（活动）自动生成独立的 FTP 账号：

1. **在 PIS 后台创建相册**
2. **进入相册设置** → 开启 "FTP 上传" 功能
3. **查看 FTP 信息**：
   - 服务器地址: 你的服务器 IP 或域名
   - 端口: 21
   - 用户名: `album_{相册ID}`（例如：`album_123`）
   - 密码: 自动生成的 16 位随机密码
   - 传输模式: 被动模式 (PASV)

### 配置相机 FTP

将上述信息配置到相机/手机的 FTP 客户端中，照片将自动上传到对应相册。

### FTP 服务基础配置

在 `.env` 文件或 docker-compose 中配置：

```bash
# FTP 基础端口配置（系统级）
FTP_PASV_URL=你的服务器公网IP  # 被动模式公网地址
```

- FTP 命令端口: 21
- 被动模式端口范围: 30000-30009

## 密钥管理

### 更新密钥

```bash
# 1. 修改密钥文件
echo -n "new-password" > docker/secrets/db_password

# 2. 重启相关服务
docker compose -f docker/docker-compose.secrets.yml restart web worker postgres
```

### 备份密钥

```bash
# 备份到安全位置（加密）
cd docker/secrets
tar -czf - * | gpg -c > ../secrets-backup.tar.gz.gpg

# 保存到密码管理器或安全存储
```

### 恢复密钥

```bash
# 从备份恢复
cd docker/secrets
gpg -d ../secrets-backup.tar.gz.gpg | tar -xzf -
```

## 与传统方式对比

### Docker Secrets 方式（推荐）

```bash
docker compose -f docker/docker-compose.secrets.yml up -d
```

- ✅ `docker inspect` 无法查看密钥
- ✅ 密钥不出现在进程列表
- ✅ 支持细粒度权限控制
- ✅ FTP 端口保留供相机上传

### 环境变量方式（传统，仅开发使用）

```bash
# 复制并编辑 .env
cp .env.example .env
vim .env

# 启动
docker compose -f docker/docker-compose.yml up -d
```

- ❌ `docker inspect` 可查看所有密钥
- ❌ 密钥可能出现在日志中
- ⚠️ 仅建议在开发/测试环境使用

## 故障排除

### 启动失败：找不到密钥文件

```bash
# 检查密钥文件是否存在
ls -la docker/secrets/

# 重新初始化
cd docker/secrets && ./init-secrets.sh
```

### 数据库连接失败

```bash
# 检查密码是否正确
docker exec pis-postgres psql -U pis -d pis -c "SELECT 1"

# 查看 web/worker 日志
docker logs pis-web
docker logs pis-worker
```

### 相机无法上传

```bash
# 检查 FTP 密码
cat docker/secrets/ftp_password

# 检查 Worker 日志
docker logs pis-worker | grep -i ftp

# 检查端口是否开放
netstat -tlnp | grep -E '(:21|:30000)'
```

### MinIO 无法访问

```bash
# 检查 MinIO 状态
docker logs pis-minio

# 验证密钥
docker exec pis-minio cat /run/secrets/minio_access_key
```

## 安全建议

1. **定期轮换密钥**：建议每 3-6 个月更换一次密码
2. **备份密钥**：使用密码管理器或加密存储备份
3. **监控访问日志**：定期检查异常登录和上传行为
4. **限制 FTP 访问**：如果可能，使用防火墙限制 FTP 端口仅允许相机 IP 访问

## 与 law-firm 项目的区别

| 特性 | PIS | law-firm |
|------|-----|----------|
| FTP 服务 | ✅ 必需（相机上传） | ❌ 无 |
| 暴露端口 | 21, 30000-30009 | 仅 80/443 |
| 应用场景 | 摄影活动 | 律所管理 |
| 特殊配置 | FTP 被动模式 | 文档服务 |

**注意**：PIS 必须暴露 FTP 端口供相机直接上传，这是业务需求。请确保：
- FTP 密码强度足够
- 定期更换密码
- 监控上传日志
