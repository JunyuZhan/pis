# 🧪 测试启动指南

## 📊 当前状态

✅ **环境检查通过**:
- Node.js: v22.16.0 ✅
- pnpm: 9.0.0 ✅
- Docker: 已安装 ✅
- .env 文件: 存在 ✅

⚠️ **需要启动**:
- Docker daemon: 未运行 ⚠️

---

## 🚀 开始测试

### 步骤 1: 启动 Docker Desktop

**macOS**:
```bash
# 打开 Docker Desktop 应用
open -a Docker
```

**或手动启动**:
1. 在应用程序中找到 Docker Desktop
2. 点击启动
3. 等待 Docker 图标在菜单栏显示为运行状态

**验证 Docker 是否运行**:
```bash
docker ps
# 应该显示容器列表（可能为空，但不会报错）
```

### 步骤 2: 启动服务并运行测试

**方式 A: 一键启动并测试（推荐）**
```bash
bash scripts/test/start-and-test.sh
```

**方式 B: 手动启动服务**
```bash
# 1. 启动 Docker 服务
cd docker && docker compose up -d

# 2. 等待服务就绪（约 30 秒）
sleep 30

# 3. 运行快速验证
pnpm test:quick
```

### 步骤 3: 运行完整测试

```bash
# 快速验证（~2分钟）
pnpm test:quick

# 综合测试（~10分钟）
bash scripts/test/comprehensive-test.sh

# E2E 测试（可视化，推荐）
pnpm test:e2e:ui
```

---

## 📋 测试选项

### 不需要 Docker 的测试

```bash
# 代码检查
pnpm lint

# 代码格式化检查
pnpm format --check

# TypeScript 类型检查
cd apps/web && pnpm exec tsc --noEmit
```

### 需要 Docker 的测试

```bash
# 快速验证（需要 Docker）
pnpm test:quick

# 业务逻辑测试
bash scripts/test/test-business-logic.sh

# API 端点测试
bash scripts/test/test-api-endpoints.sh

# 完整功能测试
bash scripts/test/test-full-features.sh
```

---

## 🔍 问题排查

### Docker daemon 未运行

**症状**: `Cannot connect to the Docker daemon`

**解决方案**:
1. macOS: 打开 Docker Desktop 应用
2. Linux: `sudo systemctl start docker`
3. Windows: 启动 Docker Desktop

### 服务启动失败

**检查日志**:
```bash
cd docker && docker compose logs
```

**重启服务**:
```bash
cd docker && docker compose down && docker compose up -d
```

### 端口被占用

**检查端口占用**:
```bash
# macOS/Linux
lsof -i :8081
lsof -i :3000

# 或使用
netstat -an | grep 8081
```

**解决方案**: 修改 `docker/docker-compose.yml` 中的端口映射

---

## ✅ 测试完成标准

### 快速验证通过
- ✅ 所有服务健康检查通过
- ✅ 数据库连接正常
- ✅ API 端点可访问

### 完整测试通过
- ✅ 业务逻辑测试通过
- ✅ API 端点功能正常
- ✅ E2E 测试通过
- ✅ 无严重错误

---

**下一步**: 启动 Docker Desktop，然后运行 `bash scripts/test/start-and-test.sh`
