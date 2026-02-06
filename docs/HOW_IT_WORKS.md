# PIS 系统工作原理详解

> 本文档详细说明 PIS 系统是如何工作的，包括架构、数据流和工作流程

---

## 🎯 系统概述

PIS (Private Instant Photo Sharing) 是一个**私有化即时摄影分享系统**，专为摄影师设计，支持：
- 📸 相机 FTP 直传
- 🖼️ 自动图片处理（缩略图、预览图、水印）
- 🌐 Web 相册展示
- 📱 移动端优化

---

## 📊 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      用户访问层                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  摄影师/管理员                   访客/客户                   │
│      ↓                              ↓                        │
│  浏览器/相机 FTP              浏览器/移动端                   │
│                                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                   网络入口层 (端口 8088)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Nginx (反向代理)                        │  │
│  │  • 统一入口: 端口 8088                               │  │
│  │  • SSL/TLS 终止 (由内网穿透处理)                      │  │
│  │  • 路径路由到不同服务                                  │  │
│  └──────────┬──────────────────┬──────────────────────┘  │
│             │                  │                          │
│             ↓                  ↓                          │
│  ┌──────────────────┐  ┌──────────────────┐              │
│  │  Next.js Web     │  │  Worker (FTP)    │              │
│  │  容器:3000       │  │  端口:21         │              │
│  └──────────┬───────┘  └──────────────────┘              │
│             │                                              │
└─────────────┼──────────────────────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────────────────────┐
│              Docker 内部网络 (pis-network)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  Next.js Web │  │   Worker     │  │    MinIO     │    │
│  │   :3000      │  │   :3001      │  │   :9000/9001 │    │
│  │              │  │              │  │              │    │
│  │ • 前端应用   │  │ • 图片处理   │  │ • 对象存储   │    │
│  │ • API 路由   │  │ • 队列处理   │  │ • S3 兼容     │    │
│  │ • 代理服务   │  │ • FTP 服务   │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                  │                  │            │
│         └──────────┬────────┴────────┬─────────┘            │
│                    │                 │                      │
│         ┌──────────▼─────────┐  ┌────▼──────────┐          │
│         │   PostgreSQL       │  │    Redis      │          │
│         │   :5432            │  │    :6379      │          │
│         │                    │  │               │          │
│         │ • 数据库存储        │  │ • 任务队列    │          │
│         │ • 用户认证          │  │ • 缓存        │          │
│         └────────────────────┘  └───────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 核心工作流程

### 1. 用户访问流程

```
用户浏览器
    ↓
[访问] https://yourdomain.com 或 http://localhost:8088
    ↓
Nginx (端口 8088)
    ↓
Next.js Web 容器 (端口 3000)
    ├──→ / → 前端页面 (React)
    ├──→ /api/* → API 路由 (Next.js API Routes)
    ├──→ /media/* → 代理到 MinIO (媒体文件)
    └──→ /minio-console/* → 代理到 MinIO Console
```

**关键点**：
- ✅ **单端口入口**：所有 Web 访问都通过 8088 端口
- ✅ **路径路由**：不同路径路由到不同服务
- ✅ **内部通信**：服务间通过 Docker 网络通信（容器名）

---

### 2. 照片上传流程

#### 方式 1: Web 界面上传

```
用户在浏览器中选择照片
    ↓
前端组件 (photo-uploader.tsx)
    ├──→ 小文件 (<5MB) → 直接上传
    └──→ 大文件 (≥5MB) → 分片上传
    ↓
POST /api/admin/albums/[id]/upload
    ↓
Next.js API Route
    ├──→ 验证用户权限
    ├──→ 接收文件流
    └──→ 调用 Worker API
    ↓
Worker 服务 (pis-worker:3001)
    ├──→ 上传原图到 MinIO (raw/{album_id}/{photo_id}.jpg)
    ├──→ 插入数据库记录 (status: pending)
    └──→ 添加到处理队列 (BullMQ)
    ↓
Redis 队列 (process-photo)
    ↓
Worker 处理任务
    ├──→ 读取原图
    ├──→ 生成缩略图 (400px)
    ├──→ 生成预览图 (2560px)
    ├──→ 应用水印 (如果配置)
    ├──→ 应用样式预设 (如果配置)
    ├──→ 上传到 MinIO (processed/thumbs/, processed/previews/)
    └──→ 更新数据库 (status: completed)
```

#### 方式 2: 相机 FTP 直传

```
相机 (Sony/Canon)
    ↓
FTP 连接 worker:21
    ├──→ 用户名: album_id 或 short_code
    └──→ 密码: upload_token
    ↓
Worker FTP 服务器
    ├──→ 验证相册和令牌
    ├──→ 接收文件流
    ├──→ 保存到临时目录
    └──→ 上传到 MinIO (raw/{album_id}/{photo_id}.jpg)
    ↓
插入数据库记录 (status: pending)
    ↓
添加到处理队列 (BullMQ)
    ↓
[后续处理同方式 1]
```

---

### 3. 照片处理流程（详细）

```
队列任务 (process-photo)
    ↓
Worker 从 Redis 队列获取任务
    ↓
步骤 1: 从 MinIO 下载原图
    ├──→ 路径: raw/{album_id}/{photo_id}.jpg
    └──→ 读取到内存 Buffer
    ↓
步骤 2: 读取相册配置
    ├──→ 水印配置 (位置、文字、Logo)
    ├──→ 样式预设 (13 种预设)
    ├──→ 旋转角度
    └──→ AI 修图配置 (可选)
    ↓
步骤 3: 图片处理 (Sharp)
    ├──→ EXIF 自动旋转
    ├──→ 手动旋转 (如果配置)
    ├──→ 生成缩略图 (400px, 质量 85%)
    ├──→ 生成预览图 (2560px, 质量 90%)
    ├──→ 应用水印 (最多 6 个)
    ├──→ 应用样式预设 (色彩调整)
    └──→ 移除 EXIF GPS 数据 (隐私保护)
    ↓
步骤 4: 上传处理后的图片
    ├──→ processed/thumbs/{album_id}/{photo_id}.jpg
    └──→ processed/previews/{album_id}/{photo_id}.jpg
    ↓
步骤 5: 更新数据库
    ├──→ status: completed
    ├──→ thumb_key: processed/thumbs/...
    ├──→ preview_key: processed/previews/...
    └──→ 记录处理时间
    ↓
步骤 6: 实时通知 (可选)
    └──→ 通过轮询机制通知前端更新
```

---

### 4. 访客浏览流程

```
访客访问相册链接
    ↓
GET /album/{slug}
    ↓
Next.js 页面
    ├──→ 检查相册是否公开
    ├──→ 检查密码保护 (如果需要)
    └──→ 查询数据库获取照片列表
    ↓
前端渲染
    ├──→ 瀑布流/网格布局
    ├──→ 懒加载图片
    └──→ BlurHash 占位符
    ↓
图片加载
    ├──→ GET /media/processed/thumbs/{album_id}/{photo_id}.jpg (缩略图)
    └──→ GET /media/processed/previews/{album_id}/{photo_id}.jpg (预览图)
    ↓
Next.js API Route (/media/[...path])
    ├──→ 代理到 MinIO (pis-minio:9000)
    ├──→ 添加缓存头 (7天)
    └──→ 流式传输
    ↓
访客查看
    ├──→ 点击图片 → Lightbox 模式
    ├──→ 下载原图 (如果允许)
    └──→ 批量下载 (如果允许)
```

---

## 🗄️ 数据存储

### 数据库 (PostgreSQL)

**主要表结构**：

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `users` | 用户管理 | id, email, password_hash, role |
| `albums` | 相册管理 | id, title, slug, upload_token, watermark_config |
| `photos` | 照片记录 | id, album_id, filename, original_key, thumb_key, preview_key, status |
| `photo_groups` | 照片分组 | id, album_id, name |
| `templates` | 相册模板 | id, name, config |

**数据流**：
```
用户操作 → Next.js API → PostgreSQL
                ↓
        查询/插入/更新数据
                ↓
        返回结果给前端
```

### 对象存储 (MinIO)

**存储结构**：
```
pis-photos/
├── raw/                    # 原图（未处理）
│   └── {album_id}/
│       └── {photo_id}.jpg
│
└── processed/              # 处理后的图片
    ├── thumbs/             # 缩略图 (400px)
    │   └── {album_id}/
    │       └── {photo_id}.jpg
    │
    └── previews/          # 预览图 (2560px)
        └── {album_id}/
            └── {photo_id}.jpg
```

**访问方式**：
- 内部：`http://pis-minio:9000/pis-photos/...`
- 外部：`http://yourdomain.com:8088/media/...` (通过 Next.js 代理)

---

## 🔐 认证与授权

### 管理员认证

```
管理员登录
    ↓
POST /api/auth/login
    ├──→ 验证用户名和密码
    ├──→ 生成 JWT Token
    └──→ 设置 HttpOnly Cookie
    ↓
后续请求
    ├──→ Cookie 自动携带
    ├──→ Middleware 验证 JWT
    └──→ 允许/拒绝访问
```

### 访客访问

```
访客访问相册
    ↓
检查相册设置
    ├──→ 公开 → 直接访问
    ├──→ 密码保护 → 要求输入密码
    └──→ 私有 → 拒绝访问
    ↓
密码验证
    ├──→ 正确 → 设置会话 Cookie
    └──→ 错误 → 返回错误
```

---

## 🔄 实时更新机制

### 轮询机制 (Standalone 模式)

```
前端组件
    ↓
每 3 秒轮询一次
    ├──→ GET /api/public/albums/{slug}/photos?since={timestamp}
    └──→ 检查是否有新照片
    ↓
有新照片？
    ├──→ 是 → 显示通知 "X 张新照片"
    └──→ 否 → 继续轮询
```

**为什么使用轮询？**
- Standalone 模式不使用 Supabase Realtime
- 轮询简单可靠，无需 WebSocket
- 3 秒间隔对用户体验影响小

---

## 📦 任务队列系统

### BullMQ 队列

```
任务类型: process-photo
    ↓
Redis 队列存储
    ├──→ 任务数据: { photoId, albumId, originalKey }
    └──→ 任务状态: waiting → active → completed
    ↓
Worker 并发处理
    ├──→ 最多 4 个并发任务
    ├──→ 自动重试失败任务
    └──→ 记录处理日志
```

**优势**：
- ✅ 异步处理，不阻塞上传
- ✅ 自动重试，提高可靠性
- ✅ 并发控制，避免资源耗尽
- ✅ 任务监控，可追踪处理状态

---

## 🌐 服务通信

### 内部通信（Docker 网络）

```
Next.js Web → PostgreSQL
    ├──→ 使用: postgres:5432
    └──→ 通过 Docker DNS 解析

Next.js Web → Worker
    ├──→ 使用: pis-worker:3001
    └──→ 通过 Docker DNS 解析

Worker → MinIO
    ├──→ 使用: pis-minio:9000
    └──→ 通过 Docker DNS 解析

Worker → Redis
    ├──→ 使用: redis:6379
    └──→ 通过 Docker DNS 解析
```

**关键点**：
- ✅ 使用容器名而非 IP 地址
- ✅ Docker 自动 DNS 解析
- ✅ 同一网络内可直接通信
- ✅ 外部无法直接访问

---

## 📱 端口说明

### 对外暴露的端口

| 端口 | 服务 | 说明 |
|------|------|------|
| **8088** | Nginx | ✅ **唯一 Web 入口**，所有 Web 访问都通过此端口 |
| 21 | Worker FTP | FTP 命令端口（相机上传） |
| 30000-30009 | Worker FTP | FTP 被动模式端口范围 |

### 内部端口（不暴露）

| 端口 | 服务 | 访问方式 |
|------|------|---------|
| 3000 | Next.js Web | 通过 Nginx 代理 (`/`) |
| 3001 | Worker API | 通过 Next.js 代理 (`/api/worker/*`) |
| 9000 | MinIO API | 通过 Next.js 代理 (`/media/*`) |
| 9001 | MinIO Console | 通过 Next.js 代理 (`/minio-console/*`) |
| 5432 | PostgreSQL | 仅 Docker 内部网络 |
| 6379 | Redis | 仅 Docker 内部网络 |

---

## 🎯 关键设计原则

### 1. 单端口入口
- ✅ 所有 Web 访问通过 8088 端口
- ✅ 其他服务不对外暴露
- ✅ 最小化攻击面

### 2. 路径路由
- ✅ `/` → Next.js 前端
- ✅ `/api/*` → Next.js API
- ✅ `/media/*` → MinIO 媒体文件
- ✅ `/api/worker/*` → Worker API

### 3. 异步处理
- ✅ 上传立即返回
- ✅ 图片处理在后台队列进行
- ✅ 不阻塞用户操作

### 4. 数据安全
- ✅ 原图存储在 `raw/` 目录（不公开）
- ✅ 处理后的图片在 `processed/` 目录（可公开）
- ✅ EXIF GPS 数据自动移除
- ✅ 密码保护相册

---

## 🔍 实际示例

### 示例 1: 摄影师上传照片

```
1. 摄影师登录管理后台
   → http://yourdomain.com:8088/admin/login

2. 选择相册，点击"上传照片"
   → 选择文件 → 前端组件处理

3. 文件上传
   → POST /api/admin/albums/{id}/upload
   → Next.js 接收 → 调用 Worker API
   → Worker 上传到 MinIO (raw/)
   → 插入数据库 (status: pending)
   → 添加到队列

4. 后台处理（异步）
   → Worker 从队列获取任务
   → 下载原图 → 处理 → 上传处理后的图片
   → 更新数据库 (status: completed)

5. 前端自动更新
   → 轮询检测新照片
   → 显示"X 张新照片"通知
```

### 示例 2: 客户查看相册

```
1. 客户收到相册链接
   → https://yourdomain.com/album/wedding-2024

2. 访问链接
   → Next.js 检查相册设置
   → 如果需要密码，显示密码输入框

3. 输入密码（如果需要）
   → POST /api/public/albums/{slug}/verify-password
   → 验证密码 → 设置会话 Cookie

4. 加载照片列表
   → GET /api/public/albums/{slug}/photos
   → 查询数据库 → 返回照片列表

5. 显示照片
   → 前端渲染瀑布流布局
   → 懒加载缩略图: /media/processed/thumbs/...
   → 点击查看大图: /media/processed/previews/...
```

---

## 📊 性能优化

### 1. 图片优化
- ✅ 多尺寸生成（缩略图、预览图）
- ✅ 懒加载和占位符
- ✅ CDN 缓存（如果配置）

### 2. 队列处理
- ✅ 并发处理（最多 4 个任务）
- ✅ 任务优先级
- ✅ 失败自动重试

### 3. 数据库优化
- ✅ 索引优化
- ✅ 查询缓存
- ✅ 连接池

---

## 🎓 总结

**PIS 系统是一个完整的照片分享平台**：

1. **统一入口**：所有访问通过 8088 端口
2. **路径路由**：不同路径路由到不同服务
3. **异步处理**：上传和处理分离，提高响应速度
4. **安全设计**：最小化暴露面，数据加密存储
5. **易于扩展**：微服务架构，可独立扩展各组件

**核心优势**：
- ✅ 完全自托管，数据隐私
- ✅ 相机 FTP 直传，无需手机 APP
- ✅ 自动图片处理，专业级效果
- ✅ 移动端优化，随时随地查看

---

**最后更新**: 2026-02-06
