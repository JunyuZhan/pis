# 🔒 安全修复说明

## 已修复的 P0 严重问题

### ✅ 1. 移除 next.config.ts 中的数据库密码
**文件**: `apps/web/next.config.ts`
**修复内容**:
- 移除了 `DATABASE_PASSWORD`、`DATABASE_USER`、`DATABASE_HOST` 等敏感配置
- 移除了 JWT 密钥前缀日志
- 只保留真正需要暴露到前端的配置

### ✅ 2. 移除登录日志中的完整密码哈希
**文件**: `apps/web/src/app/api/auth/login/route.ts`
**修复内容**:
- 移除了 `passwordHashFull` 字段
- 移除了 `passwordHashPreview` 字段
- 只保留必要的调试信息（密码长度、哈希是否存在）

### ✅ 3. 移除 JWT 密钥日志
**文件**: `apps/web/src/lib/auth/jwt.ts`
**修复内容**:
- 移除了 JWT 密钥前 10 位的日志
- 只记录密钥是否存在和长度

### ✅ 4. 移除 Worker 启动日志中的密码前缀
**文件**: `services/worker/src/index.ts`
**修复内容**:
- 移除了数据库密码前 5 位的日志
- 只记录密码是否设置

---

## 🚨 立即行动：更换所有默认密钥

### 1. 生成强随机密钥

使用以下命令生成安全的随机密钥：

```bash
# 生成 64 字符的随机密钥（推荐）
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 需要更换的密钥

在 `.env` 文件中更换以下密钥：

```bash
# 数据库密码（64 字符）
DATABASE_PASSWORD=<新生成的64字符密钥>

# JWT 密钥（至少 32 字符，建议 64 字符）
AUTH_JWT_SECRET=<新生成的64字符密钥>

# MinIO 密钥（64 字符）
MINIO_ACCESS_KEY=<新生成的64字符密钥>
MINIO_SECRET_KEY=<新生成的64字符密钥>

# Worker API 密钥（64 字符）
WORKER_API_KEY=<新生成的64字符密钥>

# Album Session 密钥（64 字符）
ALBUM_SESSION_SECRET=<新生成的64字符密钥>
```

### 3. 更换密钥后的步骤

1. **停止所有服务**:
```bash
cd docker
docker-compose down
```

2. **更新 .env 文件**:
```bash
# 编辑 .env 文件，替换所有密钥
nano .env
```

3. **重启服务**:
```bash
docker-compose up -d
```

4. **验证服务正常**:
```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

5. **测试登录功能**:
   - 登录管理后台
   - 测试相册访问
   - 测试照片上传

---

## 📋 密钥安全最佳实践

### 1. 密钥管理

- ✅ 使用强随机密钥（至少 64 字符）
- ✅ 定期更换密钥（建议每 3-6 个月）
- ✅ 不同服务使用不同的密钥
- ❌ 不要使用默认密钥
- ❌ 不要在代码中硬编码密钥
- ❌ 不要将密钥提交到版本控制

### 2. 环境变量安全

- ✅ 确保 `.env` 文件在 `.gitignore` 中
- ✅ 设置 `.env` 文件权限为 `600`（仅所有者可读写）
- ✅ 生产环境使用密钥管理服务（如 HashiCorp Vault）
- ❌ 不要在生产环境使用 `.env.example` 中的示例密钥

### 3. 日志安全

- ✅ 不要在日志中记录敏感信息
- ✅ 不要记录完整的密码、密钥、令牌
- ✅ 对敏感信息进行脱敏处理
- ❌ 不要在开发环境记录完整敏感信息

### 4. 备份安全

- ✅ 备份时排除 `.env` 文件
- ✅ 单独安全地存储密钥备份
- ✅ 使用加密的备份方案
- ❌ 不要将密钥备份到公共云存储

---

## 🔍 验证修复效果

### 1. 检查 next.config.ts

```bash
# 确认没有敏感配置
grep -E "DATABASE_PASSWORD|DATABASE_USER|DATABASE_HOST" apps/web/next.config.ts
# 应该没有任何输出
```

### 2. 检查日志文件

```bash
# 确认日志中没有敏感信息
grep -r "passwordHashFull\|substring(0, 10)\|substring(0, 5)" apps/web/src services/worker/src
# 应该没有任何输出
```

### 3. 检查 .env 文件

```bash
# 确认 .env 在 .gitignore 中
grep ".env" .gitignore
# 应该看到 .env 和 .env.local

# 检查文件权限
ls -la .env
# 应该显示 -rw------- (权限 600)
```

### 4. 测试应用

```bash
# 启动开发环境
pnpm dev

# 测试登录功能
# 测试相册访问
# 测试照片上传
```

---

## 📝 后续安全改进建议

### P1 高优先级（3-5 天）

1. **实施数据脱敏**
   - 对备份导出数据进行脱敏
   - 对审计日志导出进行脱敏
   - 对操作日志元数据进行脱敏

2. **加强 Cookie 安全**
   - 设置 `sameSite: 'strict'`
   - 生产环境强制 HTTPS
   - 添加 `domain` 限制

3. **加强 SSRF 防护**
   - 使用专业库进行 IP 验证
   - 添加请求超时限制

4. **修复连接泄露**
   - 添加数据库连接关闭逻辑
   - 添加 Cloudflare API 超时

### P2 中优先级（1-2 周）

1. **修复内存泄露**
   - 清理前端定时器
   - 清理事件监听器
   - 完善 Worker 优雅退出

2. **优化资源管理**
   - 缩短预签名 URL 有效期
   - 添加文件下载保护
   - 完善 MinIO 客户端管理

---

## 🆘 故障排除

### 问题：更换密钥后无法登录

**解决方案**:
1. 检查 `AUTH_JWT_SECRET` 是否正确设置
2. 清除浏览器 Cookie 和缓存
3. 重新启动服务
4. 检查日志中的错误信息

### 问题：MinIO 连接失败

**解决方案**:
1. 检查 `MINIO_ACCESS_KEY` 和 `MINIO_SECRET_KEY` 是否正确
2. 确认 MinIO 服务正在运行
3. 检查网络连接
4. 查看 MinIO 日志

### 问题：Worker API 调用失败

**解决方案**:
1. 检查 `WORKER_API_KEY` 是否与 Worker 配置一致
2. 确认 Worker 服务正在运行
3. 检查网络连接
4. 查看 Worker 日志

---

## 📞 获取帮助

如果遇到问题，请：

1. 查看完整的审计报告：`SECURITY_AUDIT_REPORT_2025-02-28.md`
2. 检查服务日志：`docker-compose logs -f`
3. 查看安全指南：`docs/SECURITY.md`
4. 提交 Issue：https://github.com/JunyuZhan/pis/issues

---

**修复日期**: 2025-02-28
**修复人员**: CodeArts 代码智能体
**下次审计**: 修复完成后进行复审

🎯
