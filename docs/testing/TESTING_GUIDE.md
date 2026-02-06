# 🧪 PIS 项目完整测试指南

> **目标**: 确保项目功能完全可用，业务逻辑正确

---

## 📋 目录

1. [快速开始](#快速开始)
2. [测试层次结构](#测试层次结构)
3. [完整测试流程](#完整测试流程)
4. [业务逻辑测试](#业务逻辑测试)
5. [功能完整性测试](#功能完整性测试)
6. [性能与压力测试](#性能与压力测试)
7. [安全测试](#安全测试)
8. [测试报告解读](#测试报告解读)

---

## 🚀 快速开始

### 前置准备

```bash
# 1. 安装依赖
pnpm install

# 2. 启动服务
# 方式A: Docker 方式（生产/测试环境，端口 8081）
cd docker && docker-compose up -d

# 方式B: 开发模式（开发环境，端口 3000）
pnpm dev

# 3. 安装 Playwright 浏览器（首次运行 E2E 测试）
pnpm exec playwright install --with-deps
```

### ⚠️ 重要：端口说明

- **Docker/生产环境**: 使用端口 `8081`（通过 Nginx 代理）
- **开发模式**: 使用端口 `3000`（Next.js 开发服务器）
- **E2E 测试**: 默认使用端口 `3000`（Playwright 配置）

**测试脚本端口**:
- 大部分测试脚本使用 `8081`（针对 Docker 环境）
- E2E 测试使用 `3000`（针对开发环境）
- 可通过环境变量 `BASE_URL` 覆盖默认端口

### 一键运行完整测试

```bash
# 方式1: 运行综合测试套件（推荐）
bash scripts/test/comprehensive-test.sh

# 方式2: 运行所有测试脚本
bash scripts/test/test-all.sh

# 方式3: 运行完整功能测试
bash scripts/test/test-full-features.sh
```

---

## 🏗️ 测试层次结构

PIS 项目采用**多层次测试策略**，确保从单元到集成的全面覆盖：

```
┌─────────────────────────────────────┐
│   E2E 测试 (端到端)                 │  ← 用户视角，完整业务流程
│   - admin-flow.spec.ts              │
│   - guest-flow.spec.ts              │
│   - photo-upload-flow.spec.ts       │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   集成测试 (Integration)            │  ← 服务间交互
│   - API 端点测试                    │
│   - 数据库连接测试                   │
│   - Redis/MinIO 功能测试             │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│   单元测试 (Unit)                   │  ← 独立功能模块
│   - 组件测试 (.test.tsx)            │
│   - 工具函数测试 (.test.ts)         │
│   - 业务逻辑测试                     │
└─────────────────────────────────────┘
```

---

## 📊 完整测试流程

### 阶段 1: 环境与基础设施检查

```bash
# 1.1 检查 Docker 服务
docker ps | grep pis-

# 1.2 检查容器健康状态
docker inspect pis-postgres --format '{{.State.Health.Status}}'
docker inspect pis-redis --format '{{.State.Health.Status}}'
docker inspect pis-minio --format '{{.State.Health.Status}}'

# 1.3 检查服务可访问性
curl http://localhost:8081/api/health
curl http://localhost:8081/api/worker/health
```

**预期结果**:
- ✅ 所有容器运行正常
- ✅ 健康检查返回 `healthy`
- ✅ API 端点返回 `200 OK`

---

### 阶段 2: 业务逻辑测试

#### 2.1 用户认证流程

```bash
# 运行登录流程测试
bash scripts/test/test-login-flow.sh
```

**测试内容**:
- ✅ 管理员账户状态检查
- ✅ 登录 API 验证（空数据、无效格式）
- ✅ 用户名登录支持（admin -> admin@example.com）
- ✅ 错误密码处理
- ✅ SQL 注入防护
- ✅ XSS 防护
- ✅ CORS 配置
- ✅ 速率限制

#### 2.2 API 端点功能

```bash
# 运行 API 端点测试
bash scripts/test/test-api-endpoints.sh
```

**测试内容**:
- ✅ 健康检查端点 (`/api/health`)
- ✅ 认证端点 (`/api/auth/*`)
- ✅ 公开相册端点 (`/api/public/albums/*`)
- ✅ 管理端点 (`/api/admin/*`)
- ✅ Worker 代理端点 (`/api/worker/*`)
- ✅ Media 代理端点 (`/media/*`)

#### 2.3 数据库功能

```bash
# 运行数据库功能测试
bash scripts/test/test-database-performance.sh
```

**测试内容**:
- ✅ 数据库连接
- ✅ 表结构完整性
- ✅ 索引有效性
- ✅ 查询性能
- ✅ 事务处理

---

### 阶段 3: 功能完整性测试

#### 3.1 核心功能测试

```bash
# 运行完整功能测试
bash scripts/test/test-full-features.sh
```

**测试内容**:

**上传功能**:
- ✅ 单文件上传
- ✅ 批量上传
- ✅ 大文件上传（>10MB）
- ✅ 图片格式验证（JPG, PNG, HEIC）
- ✅ 上传进度跟踪

**图片处理**:
- ✅ 缩略图生成（400px）
- ✅ 预览图生成（2560px）
- ✅ EXIF 信息提取
- ✅ 自动旋转
- ✅ BlurHash 生成

**相册管理**:
- ✅ 创建相册
- ✅ 编辑相册设置
- ✅ 删除相册
- ✅ 相册密码保护
- ✅ 相册过期时间

**下载功能**:
- ✅ 单张照片下载
- ✅ 批量下载（ZIP）
- ✅ 水印版本下载
- ✅ 原图下载

#### 3.2 E2E 用户流程测试

```bash
# 运行 E2E 测试（UI 模式，推荐）
pnpm test:e2e:ui

# 或命令行模式
pnpm test:e2e
```

**测试场景**:

1. **管理员流程** (`e2e/admin-flow.spec.ts`):
   - 登录管理后台
   - 创建相册
   - 上传照片
   - 配置相册设置
   - 查看统计信息

2. **访客流程** (`e2e/guest-flow.spec.ts`):
   - 访问公开相册
   - 输入密码（如需要）
   - 浏览照片
   - 选择照片
   - 下载照片

3. **上传流程** (`e2e/photo-upload-flow.spec.ts`):
   - 选择文件
   - 上传进度显示
   - 处理状态更新
   - 错误处理

4. **移动端流程** (`e2e/mobile.spec.ts`):
   - 移动设备适配
   - 触摸交互
   - 响应式布局

---

### 阶段 4: 边界情况测试

```bash
# 运行边界情况测试
bash scripts/test/test-edge-cases.sh
```

**测试内容**:
- ✅ 空数据输入
- ✅ 超长字符串
- ✅ 特殊字符处理
- ✅ 并发请求
- ✅ 网络中断恢复
- ✅ 文件损坏处理
- ✅ 无效 UUID 格式
- ✅ 权限边界测试

---

### 阶段 5: 性能与压力测试

#### 5.1 高并发测试

```bash
# 运行高并发测试
bash scripts/test/test-high-concurrency.sh
```

**测试内容**:
- ✅ 100+ 并发请求
- ✅ 响应时间 < 500ms
- ✅ 无内存泄漏
- ✅ 数据库连接池管理
- ✅ Redis 连接管理

#### 5.2 数据库性能测试

```bash
# 运行数据库性能测试
bash scripts/test/test-database-performance.sh
```

**测试内容**:
- ✅ 查询响应时间
- ✅ 索引使用情况
- ✅ 连接池效率
- ✅ 慢查询检测

---

### 阶段 6: 安全测试

```bash
# 运行安全检查
pnpm security-check

# 或运行完整安全测试
bash scripts/test/comprehensive-test.sh --skip-build --skip-stress
```

**测试内容**:
- ✅ SQL 注入防护
- ✅ XSS 防护
- ✅ CSRF 防护
- ✅ 路径遍历防护
- ✅ 敏感信息泄露检查
- ✅ 密码强度验证
- ✅ JWT 令牌安全

---

## 🔍 业务逻辑测试详解

### 1. 用户初始化功能测试

**测试新添加的 `init-users` 功能**:

```bash
# 1. 测试用户初始化脚本
pnpm init-users

# 2. 验证各角色账户创建
docker exec pis-postgres psql -U pis -d pis -c \
  "SELECT email, role, is_active FROM users ORDER BY role;"

# 预期结果:
# - admin@pis.com (admin)
# - photographer@pis.com (photographer)
# - retoucher@pis.com (retoucher)
# - guest@pis.com (guest)
```

**验证点**:
- ✅ 所有角色账户已创建
- ✅ 邮箱格式正确
- ✅ 角色分配正确
- ✅ 账户状态为激活

### 2. 相册创建与配置

```bash
# 通过 API 测试相册创建
curl -X POST http://localhost:8081/api/admin/albums \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "title": "测试相册",
    "slug": "test-album",
    "password": "test123",
    "expires_at": "2026-12-31T23:59:59Z"
  }'
```

**验证点**:
- ✅ 相册创建成功
- ✅ Slug 唯一性验证
- ✅ 密码加密存储
- ✅ 过期时间设置

### 3. 照片上传与处理流程

```bash
# 1. 上传照片
curl -X POST http://localhost:8081/api/admin/albums/{album_id}/upload \
  -F "file=@test-photo.jpg"

# 2. 检查处理状态
curl http://localhost:8081/api/admin/albums/{album_id}/photos

# 3. 验证缩略图和预览图生成
curl http://localhost:8081/media/{thumb_key}
curl http://localhost:8081/media/{preview_key}
```

**验证点**:
- ✅ 照片上传成功
- ✅ 状态从 `pending` → `processing` → `completed`
- ✅ 缩略图生成（400px）
- ✅ 预览图生成（2560px）
- ✅ EXIF 信息提取
- ✅ BlurHash 生成

### 4. 水印功能测试

```bash
# 1. 配置相册水印
curl -X PATCH http://localhost:8081/api/admin/albums/{album_id} \
  -H "Content-Type: application/json" \
  -d '{
    "watermark_enabled": true,
    "watermark_type": "text",
    "watermark_config": {
      "text": "测试水印",
      "position": "bottom-right"
    }
  }'

# 2. 重新处理照片应用水印
curl -X POST http://localhost:8081/api/admin/photos/{photo_id}/reprocess
```

**验证点**:
- ✅ 水印配置保存
- ✅ 水印正确应用
- ✅ 位置正确
- ✅ 透明度正确

---

## 📈 测试报告解读

### 综合测试报告

运行 `bash scripts/test/comprehensive-test.sh` 后，会生成测试摘要：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 测试结果摘要
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

总测试数: 45
通过: 43
失败: 2
警告: 0

✅ 所有测试通过！
```

### E2E 测试报告

运行 `pnpm test:e2e` 后，查看 HTML 报告：

```bash
# 打开 HTML 报告
pnpm exec playwright show-report
```

报告包含:
- ✅ 测试通过/失败状态
- ✅ 执行时间
- ✅ 失败截图
- ✅ 失败视频（如配置）
- ✅ 追踪文件（trace）

### 覆盖率报告

```bash
# 生成覆盖率报告
cd apps/web
pnpm test:coverage

# 查看报告
open coverage/index.html
```

**目标覆盖率**:
- 业务逻辑: > 80%
- 工具函数: > 90%
- 组件: > 70%

---

## 🎯 测试检查清单

### 核心功能检查清单

- [ ] **用户认证**
  - [ ] 登录功能正常
  - [ ] 密码设置功能正常
  - [ ] 会话管理正常
  - [ ] 登出功能正常

- [ ] **相册管理**
  - [ ] 创建相册
  - [ ] 编辑相册
  - [ ] 删除相册
  - [ ] 相册设置（密码、过期时间）
  - [ ] 相册模板

- [ ] **照片上传**
  - [ ] 单文件上传
  - [ ] 批量上传
  - [ ] FTP 上传
  - [ ] 上传进度显示
  - [ ] 错误处理

- [ ] **图片处理**
  - [ ] 缩略图生成
  - [ ] 预览图生成
  - [ ] EXIF 提取
  - [ ] 自动旋转
  - [ ] 水印应用
  - [ ] 风格预设应用

- [ ] **照片管理**
  - [ ] 照片列表显示
  - [ ] 照片删除
  - [ ] 照片恢复
  - [ ] 照片排序
  - [ ] 照片分组

- [ ] **下载功能**
  - [ ] 单张下载
  - [ ] 批量下载（ZIP）
  - [ ] 水印版本下载
  - [ ] 原图下载

- [ ] **访客功能**
  - [ ] 相册访问
  - [ ] 密码验证
  - [ ] 照片选择
  - [ ] 照片浏览（灯箱模式）

### 业务逻辑检查清单

- [ ] **数据一致性**
  - [ ] 相册照片数量统计准确
  - [ ] 照片状态更新正确
  - [ ] 删除操作级联正确

- [ ] **权限控制**
  - [ ] 管理员权限正确
  - [ ] 访客权限受限
  - [ ] 未授权访问被拒绝

- [ ] **错误处理**
  - [ ] 友好错误提示
  - [ ] 错误日志记录
  - [ ] 异常恢复机制

---

## 🐛 常见问题排查

### 问题 1: 测试失败 - 服务未启动

**症状**: `curl: (7) Failed to connect to localhost:8081`

**解决方案**:
```bash
# 检查服务状态
docker ps | grep pis-

# 启动服务
cd docker && docker-compose up -d

# 等待服务就绪
sleep 10
curl http://localhost:8081/api/health
```

### 问题 2: 数据库连接失败

**症状**: `Error: connect ECONNREFUSED`

**解决方案**:
```bash
# 检查 PostgreSQL 容器
docker exec pis-postgres psql -U pis -d pis -c "SELECT 1;"

# 检查环境变量
cat .env | grep DATABASE

# 重启数据库容器
docker restart pis-postgres
```

### 问题 3: E2E 测试超时

**症状**: `Timeout 30000ms exceeded`

**解决方案**:
```bash
# 增加超时时间（在 playwright.config.ts）
timeout: 60 * 1000  # 60秒

# 或检查服务响应时间
time curl http://localhost:8081/api/health
```

### 问题 4: 图片处理失败

**症状**: 照片状态一直为 `processing`

**解决方案**:
```bash
# 检查 Worker 服务日志
docker logs pis-worker

# 检查 Redis 队列
docker exec pis-redis redis-cli LLEN bull:process-photo:waiting

# 重启 Worker 服务
docker restart pis-worker
```

---

## 📚 相关文档

- [测试文档](./TESTING.md) - 详细测试配置和说明
- [测试覆盖率分析](./TEST_COVERAGE_ANALYSIS.md) - 测试覆盖情况
- [开发指南](./DEVELOPMENT.md) - 开发环境搭建
- [部署指南](./i18n/zh-CN/DEPLOYMENT.md) - 部署相关测试

---

## ✅ 测试完成标准

项目功能完全可用、业务逻辑正确的标准：

1. **所有测试通过**: 
   - ✅ 单元测试通过率 > 95%
   - ✅ 集成测试通过率 100%
   - ✅ E2E 测试通过率 100%

2. **核心功能正常**:
   - ✅ 用户认证流程完整
   - ✅ 相册创建和管理正常
   - ✅ 照片上传和处理正常
   - ✅ 下载功能正常

3. **性能达标**:
   - ✅ API 响应时间 < 500ms
   - ✅ 图片处理时间 < 5s（单张）
   - ✅ 并发支持 > 100 请求/秒

4. **安全合规**:
   - ✅ 无 SQL 注入漏洞
   - ✅ 无 XSS 漏洞
   - ✅ 敏感信息加密存储
   - ✅ 权限控制正确

5. **数据一致性**:
   - ✅ 数据库约束正确
   - ✅ 级联删除正常
   - ✅ 统计信息准确

---

**最后更新**: 2026-02-06  
**维护者**: PIS 开发团队
