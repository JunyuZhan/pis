# 环境配置文件填写指南

> 最后更新：2026-02-07

## 🎯 快速开始

### 方式一：使用部署脚本（推荐，最简单）

**如果你是新用户，强烈推荐使用部署脚本**，它会自动生成大部分配置：

```bash
bash docker/deploy.sh
```

部署脚本会：
- ✅ 自动生成所有安全密钥（密码、API Key 等）
- ✅ 自动配置容器名和网络地址
- ✅ 引导你填写域名等基本信息
- ✅ 自动生成完整的 `.env` 文件

**你只需要回答几个简单问题**：
- 域名是什么？（本地测试填 `localhost`）
- 数据库密码（留空会自动生成）
- MinIO 密码（留空会自动生成）

---

### 方式二：手动配置

如果你需要手动配置，请按照以下步骤：

#### 1. 复制配置文件

```bash
cp .env.example .env
```

#### 2. 编辑配置文件

打开 `.env` 文件，根据你的实际情况修改以下配置：

---

## 📝 必填配置项（最小配置）

### 本地测试（最简单）

如果你只是想本地测试，**保持以下配置不变**即可：

```bash
# 域名
DOMAIN=localhost

# 应用地址
NEXT_PUBLIC_APP_URL=http://localhost:8088
NEXT_PUBLIC_MEDIA_URL=http://localhost:8088/media
NEXT_PUBLIC_WORKER_URL=http://localhost:8088/worker-api
```

其他配置保持默认值，部署脚本会自动生成密钥。

---

### 生产环境（有域名）

如果你有域名并要部署到生产环境：

#### 1. 修改域名配置

```bash
# 填写你的域名（不要加 http:// 或 https://）
DOMAIN=pis.example.com

# 如果配置了 HTTPS（推荐）
NEXT_PUBLIC_APP_URL=https://pis.example.com
NEXT_PUBLIC_MEDIA_URL=https://pis.example.com/media
NEXT_PUBLIC_WORKER_URL=https://pis.example.com/worker-api

# 如果还没配置 HTTPS（临时使用）
NEXT_PUBLIC_APP_URL=http://pis.example.com
NEXT_PUBLIC_MEDIA_URL=http://pis.example.com/media
NEXT_PUBLIC_WORKER_URL=http://pis.example.com/worker-api
```

#### 2. 生成安全密钥

**重要**：生产环境必须修改以下密钥，不要使用默认值：

```bash
# 数据库密码（至少 32 字符）
DATABASE_PASSWORD=你的强密码（至少32字符）

# JWT 密钥（至少 64 字符十六进制）
AUTH_JWT_SECRET=你的JWT密钥（64字符十六进制）

# Worker API 密钥（至少 64 字符十六进制）
WORKER_API_KEY=你的Worker密钥（64字符十六进制）

# MinIO 访问密钥（至少 20 字符）
MINIO_ACCESS_KEY=你的MinIO访问密钥
MINIO_SECRET_KEY=你的MinIO密钥（至少40字符）
```

**生成密钥的方法**：

```bash
# 生成 64 字符十六进制密钥（用于 JWT、Worker API）
openssl rand -hex 32

# 生成随机字符串（用于密码）
openssl rand -base64 32
```

---

### 内网穿透（frpc/ddnsto）

如果你使用内网穿透服务：

#### frpc 配置示例

```bash
DOMAIN=pis.example.com
NEXT_PUBLIC_APP_URL=https://pis.example.com
NEXT_PUBLIC_MEDIA_URL=https://pis.example.com/media
NEXT_PUBLIC_WORKER_URL=https://pis.example.com/worker-api
```

#### ddnsto 配置示例

```bash
DOMAIN=yourname.ddnsto.com
NEXT_PUBLIC_APP_URL=https://yourname.ddnsto.com
NEXT_PUBLIC_MEDIA_URL=https://yourname.ddnsto.com/media
NEXT_PUBLIC_WORKER_URL=https://yourname.ddnsto.com/worker-api
```

---

## 🔧 可选配置项

### FTP 配置（相机直传）

只有需要使用相机 FTP 直传功能时才需要配置：

```bash
# 局域网部署：填写服务器局域网 IP
FTP_PASV_URL=192.168.50.10

# 公网部署：填写公网 IP 或域名
FTP_PASV_URL=ftp.example.com
```

### 邮件通知配置

只有需要发送邮件通知时才需要配置：

```bash
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_USER=your-email@qq.com
SMTP_PASS=你的邮箱授权码
```

### Cloudflare 配置

只有使用 Cloudflare 服务时才需要配置：

```bash
# Turnstile（登录验证码）
NEXT_PUBLIC_TURNSTILE_SITE_KEY=你的站点密钥
TURNSTILE_SECRET_KEY=你的密钥

# CDN 缓存清除
CLOUDFLARE_API_TOKEN=你的API令牌
CLOUDFLARE_ZONE_ID=你的Zone ID
```

---

## ❓ 常见问题

### Q: 我应该使用部署脚本还是手动配置？

**A**: 
- **新用户**：强烈推荐使用部署脚本（`bash docker/deploy.sh`）
- **有经验用户**：可以手动配置，更灵活

### Q: 本地测试需要修改哪些配置？

**A**: 基本不需要修改，保持默认值即可。部署脚本会自动生成密钥。

### Q: 生产环境必须修改哪些配置？

**A**: 
1. **域名相关**：`DOMAIN`、`NEXT_PUBLIC_APP_URL`、`NEXT_PUBLIC_MEDIA_URL`、`NEXT_PUBLIC_WORKER_URL`
2. **安全密钥**：`DATABASE_PASSWORD`、`AUTH_JWT_SECRET`、`WORKER_API_KEY`、`MINIO_ACCESS_KEY`、`MINIO_SECRET_KEY`

### Q: 如何生成安全密钥？

**A**: 
```bash
# 生成 64 字符十六进制密钥
openssl rand -hex 32

# 生成随机密码
openssl rand -base64 32
```

### Q: 容器名配置需要修改吗？

**A**: **不需要**。Docker 部署时，部署脚本会自动将 `localhost` 替换为正确的容器名（`postgres`、`pis-minio` 等）。

### Q: 配置错了怎么办？

**A**: 
1. 重新运行部署脚本：`bash docker/deploy.sh`
2. 或者手动编辑 `.env` 文件修改配置
3. 修改后重启服务：`cd docker && docker compose restart`

---

## 📚 更多帮助

- **部署文档**：`docs/i18n/zh-CN/DEPLOYMENT.md`
- **环境变量说明**：`docs/ENVIRONMENT_VARIABLES.md`
- **配置示例**：`.env.example`（文件中有详细注释）

---

**提示**：如果遇到问题，建议使用部署脚本重新生成配置，这样可以确保所有配置都是正确的。
