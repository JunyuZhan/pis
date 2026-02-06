# 🚀 本地开发环境测试指南

## ✅ 当前状态

**开发环境容器已启动**:
- ✅ PostgreSQL: `localhost:5432` (容器: pis-postgres-dev)
- ✅ Redis: `localhost:6379` (容器: pis-redis-dev)
- ✅ MinIO: `localhost:9000/9001` (容器: pis-minio-dev)

---

## 🎯 快速开始本地测试

### 步骤 1: 检查环境变量配置

确保 `.env` 文件中数据库配置使用 `localhost`（开发环境）：

```bash
# 检查配置
grep DATABASE_HOST .env

# 应该显示:
# DATABASE_HOST=localhost
```

**如果显示 `DATABASE_HOST=postgres`，需要修改为 `localhost`**:
```bash
# 修改 .env 文件
sed -i '' 's/DATABASE_HOST=postgres/DATABASE_HOST=localhost/g' .env
```

### 步骤 2: 启动开发服务器

**方式 A: 一键启动（推荐）**
```bash
pnpm dev
```

这会同时启动：
- Web 前端 (Next.js): `http://localhost:3000`
- Worker 服务: `http://localhost:3001`

**方式 B: 分别启动（便于查看日志）**

终端 1 - Web 前端:
```bash
pnpm dev:web
```

终端 2 - Worker 服务:
```bash
pnpm dev:worker
```

### 步骤 3: 运行测试

**等待开发服务器启动后（约 30 秒），运行测试**:

#### 1. E2E 测试（可视化，推荐）
```bash
pnpm test:e2e:ui
```

#### 2. 业务逻辑测试
```bash
BASE_URL=http://localhost:3000 bash scripts/test/test-business-logic.sh
```

#### 3. API 端点测试
```bash
BASE_URL=http://localhost:3000 bash scripts/test/test-api-endpoints.sh
```

#### 4. 快速验证（需要修改端口）
```bash
BASE_URL=http://localhost:3000 bash scripts/test/quick-verify.sh
```

---

## 📋 不需要服务的测试

这些测试可以在开发服务器启动前运行：

### 代码检查
```bash
pnpm lint
```

### 组件测试
```bash
pnpm test:components
```

### TypeScript 类型检查
```bash
cd apps/web && pnpm exec tsc --noEmit
```

---

## 🔍 验证服务状态

### 检查容器状态
```bash
docker ps --filter "name=pis-"
```

### 检查数据库连接
```bash
docker exec pis-postgres-dev psql -U pis -d pis -c "SELECT 1;"
```

### 检查 Redis 连接
```bash
docker exec pis-redis-dev redis-cli PING
```

### 检查 MinIO
```bash
# 访问 MinIO Console
open http://localhost:9001
# 用户名: minioadmin
# 密码: minioadmin
```

### 检查开发服务器
```bash
curl http://localhost:3000/api/health
```

---

## 🐛 常见问题

### 问题 1: 数据库连接失败

**症状**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解决方案**:
1. 检查容器是否运行: `docker ps | grep postgres`
2. 检查 `.env` 中 `DATABASE_HOST=localhost`
3. 检查端口是否被占用: `lsof -i :5432`

### 问题 2: 端口被占用

**症状**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 或使用
lsof -i :3001

# 停止进程或修改端口
```

### 问题 3: 环境变量未生效

**解决方案**:
```bash
# 确保 .env 文件在项目根目录
ls -la .env

# 重启开发服务器
# Ctrl+C 停止，然后重新运行 pnpm dev
```

---

## 📊 测试流程建议

### 快速测试流程（~5分钟）

1. **启动开发服务器**
   ```bash
   pnpm dev
   ```

2. **等待服务就绪**（约 30 秒）

3. **运行 E2E 测试**
   ```bash
   pnpm test:e2e:ui
   ```

### 完整测试流程（~15分钟）

1. **代码检查**
   ```bash
   pnpm lint
   ```

2. **启动开发服务器**
   ```bash
   pnpm dev
   ```

3. **运行业务逻辑测试**
   ```bash
   BASE_URL=http://localhost:3000 bash scripts/test/test-business-logic.sh
   ```

4. **运行 E2E 测试**
   ```bash
   pnpm test:e2e:ui
   ```

---

## 🎯 下一步

1. ✅ **开发环境容器已启动**
2. ⏭️ **启动开发服务器**: `pnpm dev`
3. ⏭️ **运行测试**: `pnpm test:e2e:ui`

---

**提示**: 本地开发模式比 Docker 构建快得多，适合快速迭代和测试！
