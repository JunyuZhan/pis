# PIS Docker Secrets

此目录用于存放敏感信息文件，**所有文件内容都不会被 Git 跟踪**。

## 安全特性

使用文件存储密钥而非环境变量的优势：
- `docker inspect` 无法查看密钥内容
- 密钥不会出现在进程列表或日志中
- 支持更细粒度的文件权限控制（chmod 600）

## 快速初始化

```bash
# 运行初始化脚本（自动生成所有密钥文件）
./init-secrets.sh
```

## 手动创建密钥文件

如果需要手动创建，每个文件只包含密钥值本身（无换行符）：

```bash
# 数据库密码
echo -n "your-strong-db-password" > db_password

# JWT 密钥（建议64字符以上）
openssl rand -base64 64 | tr -d '\n' > jwt_secret

# MinIO 访问密钥
echo -n "your-minio-access-key" > minio_access_key
openssl rand -base64 32 | tr -d '\n' > minio_secret_key

# Worker API 密钥
openssl rand -base64 32 | tr -d '\n' > worker_api_key

# 相册会话密钥
openssl rand -base64 32 | tr -d '\n' > album_session_secret

# Redis 密码（可选）
openssl rand -base64 32 | tr -d '\n' > redis_password

# Cloudflare Token（可选）
echo -n "your-cloudflare-token" > cloudflare_api_token
echo -n "your-cloudflare-zone-id" > cloudflare_zone_id

# 设置权限（仅所有者可读）
chmod 600 *
```

## 文件列表

| 文件名 | 用途 | 必需 | 说明 |
|--------|------|------|------|
| `db_password` | PostgreSQL 密码 | ✅ | 数据库连接 |
| `jwt_secret` | JWT 签名密钥 | ✅ | 用户认证 |
| `minio_access_key` | MinIO 用户名 | ✅ | 对象存储访问 |
| `minio_secret_key` | MinIO 密码 | ✅ | 对象存储访问 |
| `worker_api_key` | Worker API 密钥 | ✅ | 内部服务通信 |
| `album_session_secret` | 相册会话密钥 | ✅ | 客户端会话 |
| `redis_password` | Redis 密码 | 可选 | 缓存服务 |
| `cloudflare_api_token` | Cloudflare Token | 可选 | CDN 缓存清除 |
| `cloudflare_zone_id` | Cloudflare Zone ID | 可选 | CDN 缓存清除 |

## ⚠️ FTP 账号管理说明

**FTP 账号不是系统级密钥，不由 Docker Secrets 管理！**

每个相册（活动）都有独立的 FTP 账号和密码：

- **创建方式**：在 PIS 管理后台创建相册时自动生成
- **账号格式**：`album_{相册ID}`（例如：`album_123`）
- **密码**：系统自动生成的 16 位随机密码
- **查看位置**：相册设置 → FTP 上传

### 摄影师如何上传照片

1. 在 PIS 后台创建新相册
2. 进入相册设置，开启 "FTP 上传" 功能
3. 查看 FTP 账号信息
4. 将以下信息配置到相机/手机 FTP 客户端：
   - **服务器地址**：你的服务器 IP 或域名
   - **端口**：21
   - **用户名**：`album_123`（示例）
   - **密码**：{相册设置中显示的密码}
   - **传输模式**：被动模式 (PASV)

### FTP 服务基础配置

以下配置在 `docker-compose.secrets.yml` 中设置：

- `FTP_PORT=21` - FTP 命令端口
- `FTP_PASV_START=30000` - 被动模式起始端口
- `FTP_PASV_END=30009` - 被动模式结束端口
- `FTP_PASV_URL` - 被动模式公网地址（需要在环境变量中配置）

## 权限要求

```bash
# 确保密钥文件权限正确
chmod 600 docker/secrets/*
```

## 备份提醒

⚠️ **重要**：这些文件不会被 Git 跟踪，请确保：
1. 在安全位置备份这些密钥（密码管理器或加密存储）
2. 在新环境部署时需要重新创建或恢复
3. 相册的 FTP 密码存储在数据库中，备份数据库即可保留

## 安全部署

```bash
# 1. 初始化密钥
cd docker/secrets
./init-secrets.sh

# 2. 返回项目根目录
cd ../..

# 3. 使用安全配置启动
docker compose -f docker/docker-compose.secrets.yml up -d
```
