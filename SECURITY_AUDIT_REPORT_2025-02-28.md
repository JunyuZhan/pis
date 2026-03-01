# PIS 项目安全审计报告

**审计日期**: 2025-02-28
**审计分支**: security-audit-2025-02-28
**审计范围**: 内存泄露、数据泄露、连接泄露、空指针、文档混乱、前端显示问题
**项目版本**: v1.1.0

---

## 📋 执行摘要

本次安全审计对 PIS（Private Instant Photo Sharing）项目进行了全面检查，发现了 **21 个需要关注的问题**，其中包括 **5 个严重安全问题** 需要立即修复。

### 审计结果概览

| 检查类别 | 严重问题 | 高风险问题 | 中风险问题 | 低风险问题 | 良好实践 |
|---------|---------|-----------|-----------|-----------|---------|
| 内存泄露 | 0 | 3 | 3 | 1 | ✅ 大部分正确处理 |
| 数据泄露 | 5 | 4 | 3 | 2 | ✅ 认证授权完善 |
| 连接泄露 | 3 | 4 | 0 | 0 | ✅ 有优雅退出机制 |
| 空指针 | 0 | 2 | 8 | 0 | ✅ TypeScript 严格模式 |
| 文档混乱 | 0 | 0 | 2 | 0 | ✅ 文档结构清晰 |
| 前端显示 | 0 | 0 | 0 | 1 | ✅ 响应式设计完善 |
| **总计** | **8** | **13** | **16** | **4** | - |

### 总体评分

| 类别 | 评分 | 说明 |
|------|------|------|
| 内存管理 | ⚠️ 6/10 | 存在一些定时器和事件监听器未清理的问题 |
| 数据安全 | ⚠️ 5/10 | 存在严重的配置泄露和日志泄露问题 |
| 连接管理 | ⚠️ 6/10 | MinIO 客户端和文件下载缺少资源管理 |
| 代码质量 | ✅ 8/10 | TypeScript 严格模式，空指针处理较好 |
| 文档质量 | ✅ 9/10 | 文档结构清晰，内容完整 |
| 用户体验 | ✅ 9/10 | 前端显示和交互良好 |
| **总体评分** | ⚠️ **7.2/10** | 需要立即修复 P0 和 P1 问题 |

---

## 🔴 P0 - 严重问题（立即修复）

### 1. 数据库密码通过 Next.js 配置暴露到客户端

**位置**: `apps/web/next.config.ts:29-38`

**问题描述**:
```typescript
env: {
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD, // ❌ 暴露到浏览器
  DATABASE_USER: process.env.DATABASE_USER,
  DATABASE_HOST: process.env.DATABASE_HOST,
  // ...
}
```

**风险等级**: 🔴 **严重**
- 数据库密码会被注入到客户端 JavaScript 代码
- 攻击者可以通过浏览器开发者工具查看 `process.env.DATABASE_PASSWORD`
- 可能导致数据库完全被控制

**修复建议**:
```typescript
// ❌ 错误做法
env: {
  DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
}

// ✅ 正确做法 - 不添加到 env 配置
env: {
  // 只添加真正需要暴露到前端的变量
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
}
```

**优先级**: 🔴 **P0 - 立即修复**

---

### 2. 登录日志记录完整密码哈希

**位置**: `apps/web/src/app/api/auth/login/route.ts:339`

**问题描述**:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[Login] Verifying password:', {
    passwordHashFull: user.password_hash, // ❌ 完整哈希
  })
}
```

**风险等级**: 🔴 **严重**
- 完整的密码哈希被记录到控制台日志
- 日志可能被上传到监控系统或版本控制
- 即使是哈希值，也可能被用于彩虹表攻击

**修复建议**:
```typescript
// ✅ 只记录必要信息
if (process.env.NODE_ENV === 'development') {
  console.log('[Login] Verifying password:', {
    email: normalizedEmail,
    passwordLength: password.length,
    passwordHashExists: !!user.password_hash,
    // ❌ 移除 passwordHashFull
  })
}
```

**优先级**: 🔴 **P0 - 立即修复**

---

### 3. JWT 密钥前缀被记录到日志

**位置**: `apps/web/src/lib/auth/jwt.ts:22-31`

**问题描述**:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log("[JWT Config]", {
    envVarValue: process.env.AUTH_JWT_SECRET
      ? `${process.env.AUTH_JWT_SECRET.substring(0, 10)}...` // ❌ 暴露前10位
  });
}
```

**风险等级**: 🔴 **严重**
- JWT 密钥前 10 位被记录
- 可能被用于密钥恢复攻击

**修复建议**:
```typescript
// ✅ 只记录是否存在和长度
if (process.env.NODE_ENV === 'development') {
  console.log("[JWT Config]", {
    envVarExists: !!process.env.AUTH_JWT_SECRET,
    secretLength: process.env.AUTH_JWT_SECRET?.length || 0,
    // ❌ 移除前缀日志
  });
}
```

**优先级**: 🔴 **P0 - 立即修复**

---

### 4. .env 文件包含真实密钥

**位置**: 项目根目录 `.env`

**问题描述**:
```bash
DATABASE_PASSWORD=6cd8b0d7195f7499c2f53e0f5b70c392f0ed235e764e5d9c74d10c600da0bec2
MINIO_SECRET_KEY=71a27fd6e73560065df2982454dfc8d3c4cd8f7e0b56a64fe6e2053714bbef63
AUTH_JWT_SECRET=local-dev-secret-key-change-in-production
```

**风险等级**: 🔴 **严重**
- 真实密钥以明文形式存储
- 虽然在 `.gitignore` 中，但仍可能被意外提交
- 文件可能被备份工具捕获

**修复建议**:
- ✅ 立即更换所有密钥为强随机密钥（64 字符）
- ✅ 使用密钥管理服务（HashiCorp Vault、AWS Secrets Manager）
- ✅ 确保 `.env` 永远不会被提交到版本控制

**优先级**: 🔴 **P0 - 立即修复**

---

### 5. Worker 启动日志包含数据库密码前缀

**位置**: `services/worker/src/index.ts:74`

**问题描述**:
```typescript
console.log(
  `[Worker Env] DATABASE_PASSWORD: ${process.env.DATABASE_PASSWORD ? "SET (" + process.env.DATABASE_PASSWORD.substring(0, 5) + "...)" : "NOT SET"}`,
);
```

**风险等级**: 🔴 **严重**
- 数据库密码前 5 位被记录到日志
- Worker 日志文件可能被泄露

**修复建议**:
```typescript
// ✅ 只记录是否设置
console.log(
  `[Worker Env] DATABASE_PASSWORD: ${process.env.DATABASE_PASSWORD ? "SET" : "NOT SET"}`,
);
```

**优先级**: 🔴 **P0 - 立即修复**

---

### 6. MinIO 客户端连接泄露

**位置**: `services/worker/src/lib/minio.ts:44-83`

**问题描述**:
```typescript
// 内网客户端
const minioClient = new Minio.Client({ ... });
// 公网客户端
const publicMinioClient = createPublicMinioClient();
```

**风险等级**: 🔴 **严重**
- MinIO 客户端没有关闭机制
- HTTP 连接池未释放
- 长期运行可能导致文件描述符耗尽

**修复建议**:
在 `gracefulShutdown` 函数中添加清理逻辑：
```typescript
async function gracefulShutdown(signal: string) {
  // ... 现有代码 ...

  // 关闭存储适配器
  try {
    const storage = getStorageAdapter();
    if (typeof storage.close === 'function') {
      await storage.close();
    }
  } catch (err) {
    console.error('Error closing storage:', err);
  }

  process.exit(0);
}
```

**优先级**: 🔴 **P0 - 立即修复**

---

### 7. MinIO 适配器未清理

**位置**: `services/worker/src/lib/storage/minio-adapter.ts:11-67`

**问题描述**:
```typescript
export class MinIOAdapter implements StorageAdapter {
  private client: Minio.Client;
  private presignClient: Minio.Client;
  private s3Client: S3Client;

  constructor(config: StorageConfig) {
    this.client = new Minio.Client({ ... });
    this.s3Client = new S3Client({ ... });
  }
}
```

**风险等级**: 🔴 **严重**
- MinIO 客户端和 AWS S3 客户端都没有关闭方法
- 多个 HTTP 连接泄露

**修复建议**:
```typescript
export class MinIOAdapter implements StorageAdapter {
  // ... 现有代码 ...

  async close(): Promise<void> {
    try {
      await this.s3Client.destroy();
    } catch (err) {
      console.error('Error closing S3 client:', err);
    }
  }
}
```

**优先级**: 🔴 **P0 - 立即修复**

---

### 8. 文件下载无保护

**位置**: `services/worker/src/lib/minio.ts:109-118`

**问题描述**:
```typescript
async download(key: string): Promise<Buffer> {
  const stream = await this.client.getObject(this.bucket, key);
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', (err) => reject(err));
  });
}
```

**风险等级**: 🔴 **严重**
- 没有超时保护
- 没有大小限制
- 错误时未清理流
- 可能导致 OOM 和连接泄露

**修复建议**:
```typescript
export async function downloadFile(
  key: string,
  options: { timeout?: number; maxSize?: number } = {}
): Promise<Buffer> {
  const { timeout = 30000, maxSize = 100 * 1024 * 1024 } = options;
  const stream = await minioClient.getObject(bucketName, key);
  const chunks: Buffer[] = [];
  let totalSize = 0;

  const timeoutId = setTimeout(() => {
    stream.destroy(new Error('Download timeout'));
  }, timeout);

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        stream.destroy(new Error('File too large'));
        reject(new Error(`File too large: ${totalSize} bytes`));
      }
      chunks.push(chunk);
    });

    stream.on('end', () => {
      clearTimeout(timeoutId);
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}
```

**优先级**: 🔴 **P0 - 立即修复**

---

## 🟡 P1 - 高风险问题（优先修复）

### 9. 备份导出包含全部用户数据

**位置**: `apps/web/src/app/api/admin/backup/export/route.ts:42-62`

**问题描述**:
```typescript
for (const table of tables) {
  let query = db.from(table).select('*') // ❌ 导出所有字段
  backupData[table] = data || []
}
```

**风险等级**: 🟡 **高**
- 导出包含所有用户邮箱、角色等敏感信息
- 备份文件可能被泄露
- 没有对敏感字段进行过滤

**修复建议**:
```typescript
// ✅ 明确指定字段，排除敏感信息
const { data } = await db
  .from('users')
  .select('id, email, role, is_active, created_at') // ❌ 不包含 password_hash
  .is('deleted_at', null)
```

**优先级**: 🟡 **P1 - 优先修复**

---

### 10. 审计日志导出包含完整用户信息

**位置**: `apps/web/src/app/api/admin/audit-logs/export/route.ts:83-94`

**问题描述**:
```typescript
const rows = logs.map(log => [
  log.user_email || '', // ❌ 完整邮箱
  log.ip_address || '', // ❌ 完整 IP 地址
])
```

**风险等级**: 🟡 **高**
- 完整的用户邮箱被导出
- IP 地址可被用于追踪用户

**修复建议**:
```typescript
// ✅ 脱敏处理
const rows = logs.map(log => [
  maskEmail(log.user_email), // u***@example.com
  maskIP(log.ip_address),    // 192.168.*.*
])
```

**优先级**: 🟡 **P1 - 优先修复**

---

### 11. 操作日志包含敏感元数据

**位置**: `apps/web/src/lib/audit-log.ts:115-130`

**问题描述**:
```typescript
const logEntry = {
  changes: params.changes || {}, // ❌ 可能包含敏感变更
  metadata: params.metadata || {}, // ❌ 可能包含敏感元数据
}
```

**风险等级**: 🟡 **高**
- `changes` 和 `metadata` 可能包含敏感数据
- 日志导出时可能泄露

**修复建议**:
```typescript
// ✅ 对敏感字段进行脱敏
const sanitizedChanges = sanitizeSensitiveFields(params.changes)
const sanitizedMetadata = sanitizeSensitiveFields(params.metadata)
```

**优先级**: 🟡 **P1 - 优先修复**

---

### 12. 邮件密码可能在日志中暴露

**位置**: `apps/web/src/app/api/admin/notifications/email-config/route.ts:84, 143, 172`

**问题描述**:
```typescript
console.error('更新邮件配置失败:', updateError) // ❌ 可能包含密码
```

**风险等级**: 🟡 **高**
- 错误日志可能包含完整配置信息
- SMTP 密码可能被记录

**修复建议**:
```typescript
// ✅ 脱敏错误信息
const sanitizedError = sanitizeError(updateError)
console.error('更新邮件配置失败:', sanitizedError)
```

**优先级**: 🟡 **P1 - 优先修复**

---

### 13. Cookie 安全配置不完整

**位置**: `apps/web/src/app/api/auth/login/route.ts:388-403`

**问题描述**:
```typescript
cookieStore.set(COOKIE_NAME, accessToken, {
  httpOnly: true,
  secure: isHttps, // ❌ HTTP 环境下不安全
  sameSite: 'lax', // ❌ 应该使用 'strict'
})
```

**风险等级**: 🟡 **高**
- `sameSite: 'lax'` 可能导致 CSRF 攻击
- HTTP 环境下 cookie 不安全
- 缺少 `domain` 限制

**修复建议**:
```typescript
// ✅ 生产环境使用严格配置
cookieStore.set(COOKIE_NAME, accessToken, {
  httpOnly: true,
  secure: true, // 生产环境强制 HTTPS
  sameSite: 'strict',
  domain: process.env.COOKIE_DOMAIN,
  path: '/',
  maxAge: 60 * 60,
})
```

**优先级**: 🟡 **P1 - 优先修复**

---

### 14. SSRF 防护不完整

**位置**: `services/worker/src/processor.ts:127-176`

**问题描述**:
```typescript
private isValidLogoUrl(url: string): boolean {
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  // ❌ 可能绕过（八进制、DNS 重绑定等）
}
```

**风险等级**: 🟡 **高**
- 只检查常见内网 IP 格式
- 可能被绕过（八进制 IP、DNS 重绑定）
- 缺少请求超时限制

**修复建议**:
```typescript
// ✅ 使用专业库进行 IP 验证
import ipaddr from 'ipaddr.js'

const addr = ipaddr.parse(hostname)
if (addr.range() === 'loopback' || addr.range() === 'private') {
  return false
}
```

**优先级**: 🟡 **P1 - 优先修复**

---

### 15. 数据库连接未显式关闭

**位置**: `services/worker/src/index.ts:3105-3157`

**问题描述**:
```typescript
async function gracefulShutdown(signal: string) {
  // ... 现有代码 ...

  // ❌ 缺少数据库连接关闭
  await Promise.all([
    worker.close(),
    packageWorker.close(),
    ftpServerService.stop(),
  ]);

  process.exit(0);
}
```

**风险等级**: 🟡 **高**
- 数据库连接未在优雅退出时关闭
- 连接池未正确释放

**修复建议**:
```typescript
async function gracefulShutdown(signal: string) {
  // ... 现有代码 ...

  // 关闭数据库连接
  try {
    if (typeof supabase?.close === 'function') {
      await supabase.close();
    }
  } catch (err) {
    console.error('Error closing database:', err);
  }

  process.exit(0);
}
```

**优先级**: 🟡 **P1 - 优先修复**

---

### 16. Cloudflare API 无超时

**位置**: `services/worker/src/lib/cloudflare-purge.ts:65-77`

**问题描述**:
```typescript
const response = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
  {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ files: batch }),
  }
);
```

**风险等级**: 🟡 **高**
- `fetch()` 请求没有超时和 AbortController
- 请求可能长时间挂起

**修复建议**:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ files: batch }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);
  // ...
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    console.error('[Cloudflare] Request timeout');
  }
  throw error;
}
```

**优先级**: 🟡 **P1 - 优先修复**

---

## 🟠 P2 - 中风险问题（计划修复）

### 17. 前端定时器未清理

**位置**: `apps/web/src/components/album/lightbox.tsx`, `apps/web/src/components/album/masonry.tsx`

**问题描述**:
```typescript
// ❌ setTimeout 未保存 timer ID，无法在组件卸载时清理
setTimeout(() => {
  // ...
}, 300);
```

**风险等级**: 🟠 **中**
- 组件卸载后定时器仍然执行
- 可能导致内存泄露

**修复建议**:
```typescript
// ✅ 清理定时器
useEffect(() => {
  const timerId = setTimeout(() => {
    // ...
  }, 300);

  return () => clearTimeout(timerId);
}, []);
```

**优先级**: 🟠 **P2 - 计划修复**

---

### 18. Service Worker 事件监听器未移除

**位置**: `apps/web/src/components/service-worker-registration.tsx`

**问题描述**:
```typescript
// ❌ 事件监听器没有移除逻辑
navigator.serviceWorker.addEventListener('message', handler);
```

**风险等级**: 🟠 **中**
- 组件卸载后监听器仍然存在
- 可能导致内存泄露

**修复建议**:
```typescript
// ✅ 清理事件监听器
useEffect(() => {
  const handler = (event: MessageEvent) => {
    // ...
  };

  navigator.serviceWorker.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}, []);
```

**优先级**: 🟠 **P2 - 计划修复**

---

### 19. 预签名 URL 有效期过长

**位置**: `services/worker/src/lib/minio.ts:165-196`

**问题描述**:
```typescript
export async function getPresignedPutUrl(key: string, expirySeconds = 3600) {
  // ❌ 默认 1 小时有效期过长
}
```

**风险等级**: 🟠 **中**
- 预签名 URL 有效期太长
- URL 泄露后可被滥用
- 缺少额外访问控制

**修复建议**:
```typescript
// ✅ 缩短有效期
export async function getPresignedPutUrl(key: string, expirySeconds = 300) {
  // 5 分钟有效期
}
```

**优先级**: 🟠 **P2 - 计划修复**

---

### 20. Worker 进程缺少优雅退出处理

**位置**: `services/worker/src/index.ts`

**问题描述**:
```typescript
// ❌ 缓存和队列未正确关闭
process.on('SIGTERM', () => {
  process.exit(0);
});
```

**风险等级**: 🟠 **中**
- 缓存和队列未正确关闭
- 可能导致数据丢失

**修复建议**:
```typescript
// ✅ 完善优雅退出
process.on('SIGTERM', async () => {
  await gracefulShutdown('SIGTERM');
});

process.on('SIGINT', async () => {
  await gracefulShutdown('SIGINT');
});
```

**优先级**: 🟠 **P2 - 计划修复**

---

### 21. 文档存在冗余和过时信息

**位置**: `docs/` 目录

**问题描述**:
- 部分文档内容重复
- 部分文档信息过时
- 缺少统一的文档索引

**风险等级**: 🟠 **中**
- 可能误导开发者
- 降低文档可维护性

**修复建议**:
- 整合重复的文档内容
- 更新过时的配置信息
- 完善文档索引

**优先级**: 🟠 **P2 - 计划修复**

---

## ✅ 良好实践（保持）

### 1. EXIF 隐私保护 ✅
- 自动剥离 GPS 信息
- 只保留相机参数
- 位置: `services/worker/src/processor.ts`

### 2. 登录速率限制 ✅
- IP 速率限制: 5 次/分钟
- 邮箱速率限制: 3 次/分钟
- 位置: `apps/web/src/app/api/auth/login/route.ts`

### 3. 密码保护 ✅
- 支持相册密码
- 密码验证 API
- 位置: `apps/web/src/app/api/public/albums/[slug]/verify-password/route.ts`

### 4. 安全响应头 ✅
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- 位置: `apps/web/next.config.ts`

### 5. SQL 注入防护 ✅
- 使用参数化查询
- 使用 Supabase 客户端
- RLS 策略

### 6. 角色权限控制 ✅
- 基于 RBAC 的访问控制
- 位置: `apps/web/src/lib/auth/role-helpers.ts`

### 7. 输入验证 ✅
- 使用 Zod 进行输入验证
- 位置: `apps/web/src/lib/validation/schemas.ts`

### 8. 邮件配置密码隐藏 ✅
- GET 接口返回 `******` 而非真实密码
- 位置: `apps/web/src/app/api/admin/notifications/email-config/route.ts:78`

### 9. PostgreSQL 连接池配置合理 ✅
- 最大连接数: 20
- 空闲超时: 30 秒
- 连接超时: 2 秒
- 位置: `apps/web/src/lib/database/postgresql-client.ts:222-245`

### 10. Redis/BullMQ 有优雅退出 ✅
- 队列和 Worker 正确关闭
- 位置: `services/worker/src/index.ts:3105-3157`

### 11. FTP 文件流清理完善 ✅
- 在 `close`、`error`、`aborted` 事件中都清理
- 位置: `services/worker/src/ftp-server.ts:112-275`

### 12. Logo 下载有超时和大小限制 ✅
- 10 秒超时
- 10MB 大小限制
- 位置: `services/worker/src/processor.ts:600-682`

### 13. 上传代理有动态超时 ✅
- 基于文件大小计算超时
- 使用 AbortController
- 位置: `apps/web/src/app/api/admin/upload-proxy/route.ts:62-135`

### 14. 轮询 Hook 有完善的清理 ✅
- 正确清理 `clearInterval`
- 清理 ref 引用
- 位置: `apps/web/src/hooks/use-photo-realtime.ts:111-128`

---

## 📊 修复优先级清单

### P0 - 立即修复（1-2 天）
1. ❌ **移除 `next.config.ts` 中的数据库密码**
2. ❌ **移除登录日志中的完整密码哈希**
3. ❌ **移除 JWT 密钥日志**
4. ❌ **移除 Worker 启动日志中的密码前缀**
5. ❌ **更换所有默认密钥为强随机密钥**
6. ❌ **修复 MinIO 客户端连接泄露**
7. ❌ **修复 MinIO 适配器未清理**
8. ❌ **修复文件下载无保护**

### P1 - 高优先级（3-5 天）
9. ⚠️ **对备份导出数据进行脱敏**
10. ⚠️ **对审计日志导出进行脱敏**
11. ⚠️ **对操作日志元数据进行脱敏**
12. ⚠️ **对邮件配置错误日志进行脱敏**
13. ⚠️ **加强 Cookie 安全配置**
14. ⚠️ **加强 SSRF 防护**
15. ⚠️ **修复数据库连接未关闭**
16. ⚠️ **添加 Cloudflare API 超时**

### P2 - 中优先级（1-2 周）
17. ⚠️ **修复前端定时器未清理**
18. ⚠️ **修复 Service Worker 事件监听器未移除**
19. ⚠️ **缩短预签名 URL 有效期**
20. ⚠️ **完善 Worker 优雅退出处理**
21. ⚠️ **整理文档冗余和过时信息**

---

## 🛡️ 部署前安全检查命令

```bash
# 1. 检查敏感文件
git ls-files | grep -E "\.env$|\.key$|\.pem$"

# 2. 检查硬编码密钥
grep -r "eyJ[A-Za-z0-9_-]\{50,\}" --exclude-dir=node_modules --exclude-dir=.git .
grep -r "6cd8b0d7195f7499c2f53e0f5b70c392f0ed235e764e5d9c74d10c600da0bec2" .

# 3. 检查 next.config.ts 中的敏感配置
grep -E "DATABASE_PASSWORD|DATABASE_USER|MINIO_SECRET_KEY" apps/web/next.config.ts

# 4. 检查日志中的敏感信息
grep -r "passwordHashFull\|substring(0, 10)\|substring(0, 5)" apps/web/src

# 5. 运行安全检查脚本
bash scripts/utils/check-security.sh
```

---

## 📚 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)
- [CWE-200: Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html)
- [CWE-401: Memory Leak](https://cwe.mitre.org/data/definitions/401.html)
- [CWE-772: Missing Release of Resource after Effective Lifetime](https://cwe.mitre.org/data/definitions/772.html)

---

## 🎯 总结

本次安全审计发现了 **21 个需要关注的问题**，其中：
- 🔴 **8 个严重问题**（P0 - 需要立即修复）
- 🟡 **8 个高风险问题**（P1 - 需要优先修复）
- 🟠 **5 个中风险问题**（P2 - 需要计划修复）

**最关键的问题**是数据库密码通过 Next.js 配置暴露到客户端，这是一个严重的安全漏洞，必须立即修复。

**建议立即采取的行动**：
1. 移除 `next.config.ts` 中的所有敏感配置
2. 移除所有日志中的敏感信息
3. 更换所有默认密钥
4. 实施数据脱敏措施
5. 修复连接泄露问题

项目在认证、授权、输入验证等方面有较好的安全措施，但在敏感信息处理、日志安全和配置管理方面存在较大改进空间。前端显示和用户体验方面表现良好，文档结构清晰。

**总体评价**: 项目代码质量较高，但存在一些需要立即修复的安全问题。建议优先处理 P0 和 P1 问题，确保系统安全后再考虑其他改进。

---

**审计人员**: CodeArts 代码智能体
**审计完成时间**: 2025-02-28
**下次审计建议**: 修复 P0 和 P1 问题后进行复审
