# 测试脚本目录

本目录包含所有测试相关的脚本，按功能分类组织。

## 📁 目录结构

```
scripts/test/
├── core/              # 核心测试脚本
├── functional/        # 功能测试脚本
├── component/         # 组件测试脚本
├── performance/       # 性能测试脚本
├── check/             # 检查工具脚本
├── utils/             # 工具脚本
└── README.md          # 本文件
```

## 🚀 快速开始

### 运行所有测试

```bash
# 方式1: 使用核心测试脚本（推荐）
bash scripts/test/core/test-all.sh

# 方式2: 使用综合测试套件
bash scripts/test/core/comprehensive-test.sh

# 方式3: 快速验证
bash scripts/test/core/quick-verify.sh
```

### 运行特定类型测试

```bash
# 功能测试
bash scripts/test/functional/test-api-endpoints.sh
bash scripts/test/functional/test-login-flow.sh

# 组件测试
bash scripts/test/component/test-components.sh

# 性能测试
bash scripts/test/performance/test-database-performance.sh

# E2E 测试
bash scripts/test/utils/test-e2e.sh
```

## 📋 脚本分类说明

### 🔵 Core（核心测试）

核心测试脚本，用于运行完整的测试套件：

| 脚本 | 描述 | 用法 |
|------|------|------|
| `test-all.sh` | 运行所有测试脚本 | `bash scripts/test/core/test-all.sh` |
| `comprehensive-test.sh` | 完整测试套件 | `bash scripts/test/core/comprehensive-test.sh` |
| `test-complete.sh` | 完整测试 | `bash scripts/test/core/test-complete.sh` |
| `integration-test.sh` | 集成测试 | `bash scripts/test/core/integration-test.sh` |
| `local-test.sh` | 本地测试 | `bash scripts/test/core/local-test.sh` |
| `quick-verify.sh` | 快速验证 | `bash scripts/test/core/quick-verify.sh` |
| `run-tests.sh` | 运行所有测试 | `bash scripts/test/core/run-tests.sh` |

### 🟢 Functional（功能测试）

功能测试脚本，测试各种业务功能：

| 脚本 | 描述 |
|------|------|
| `test-api-endpoints.sh` | API 端点测试 |
| `test-auth-edge-cases.sh` | 认证边界情况测试 |
| `test-auth-session.sh` | 认证会话测试 |
| `test-login-flow.sh` | 登录流程测试 |
| `test-password-flow.sh` | 密码流程测试 |
| `test-user-init-password.sh` | 用户初始化密码测试 |
| `test-account-creation-flow.sh` | 账户创建流程测试 |
| `test-business-logic.sh` | 业务逻辑测试 |
| `test-full-features.sh` | 完整功能测试 |
| `test-edge-cases.sh` | 边界情况测试 |
| `test-user-experience.sh` | 用户体验测试 |
| `test-upload-and-processing.sh` | 上传和处理测试 |
| `test-useauth-logic.sh` | useAuth 逻辑测试 |
| `test-frontend-backend-match.sh` | 前后端匹配测试 |
| `test-deployment-flow.sh` | 部署流程测试 |
| `test-ai-retouch-global-disable.sh` | AI 修图全局禁用测试 |
| `test-360.sh` | 360度测试 |

### 🟡 Component（组件测试）

组件测试脚本：

| 脚本 | 描述 |
|------|------|
| `test-components.sh` | 组件测试 |
| `test-component-reliability.sh` | 组件可靠性测试 |

### 🟠 Performance（性能测试）

性能测试脚本：

| 脚本 | 描述 |
|------|------|
| `test-database-performance.sh` | 数据库性能测试 |
| `test-high-concurrency.sh` | 高并发测试 |
| `test-image-loading-and-cache.sh` | 图片加载和缓存测试 |

### 🔴 Check（检查工具）

检查工具脚本：

| 脚本 | 描述 |
|------|------|
| `check-frontend-permissions.sh` | 前端权限检查 |
| `check-permission-coverage.sh` | 权限覆盖率检查 |
| `check-test-status.sh` | 测试状态检查 |

### ⚪ Utils（工具脚本）

工具脚本：

| 脚本 | 描述 |
|------|------|
| `start-and-test.sh` | 启动并测试 |
| `test-browser-compat.sh` | 浏览器兼容性测试 |
| `test-mobile.sh` | 移动端测试 |
| `test-e2e.sh` | E2E 测试 |
| `test-container-communication.sh` | 容器通信测试 |

## 📖 测试文档

更多测试相关信息请参考：
- [测试指南](../../docs/TESTING_GUIDE.md) - 完整测试指南
- [如何测试](../../docs/HOW_TO_TEST.md) - 快速参考指南
- [测试文档](../../docs/TESTING.md) - 详细测试配置和说明
- [测试覆盖率分析](../../docs/TEST_COVERAGE_ANALYSIS.md) - 测试覆盖情况

## 🔄 迁移说明

**注意**: 测试脚本已重新组织到子目录中。如果您的脚本或文档中引用了旧的路径，请更新为新的路径：

```bash
# 旧路径
bash scripts/test/test-api-endpoints.sh

# 新路径
bash scripts/test/functional/test-api-endpoints.sh
```

## 📝 使用建议

1. **日常开发**: 使用 `quick-verify.sh` 快速验证
2. **功能开发**: 运行相关的 `functional/` 测试脚本
3. **组件开发**: 运行 `component/` 测试脚本
4. **性能优化**: 运行 `performance/` 测试脚本
5. **完整测试**: 运行 `core/comprehensive-test.sh`

---

**最后更新**: 2026-02-06
