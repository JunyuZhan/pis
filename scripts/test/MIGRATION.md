# 测试脚本路径迁移指南

本文档说明测试脚本重新组织后的路径变化。

## 📋 路径变更总览

测试脚本已按功能分类到子目录中，所有脚本路径都已更新。

## 🔄 路径对照表

### Core（核心测试）

| 旧路径 | 新路径 |
|--------|--------|
| `scripts/test/quick-verify.sh` | `scripts/test/core/quick-verify.sh` |
| `scripts/test/integration-test.sh` | `scripts/test/core/integration-test.sh` |
| `scripts/test/comprehensive-test.sh` | `scripts/test/core/comprehensive-test.sh` |
| `scripts/test/test-all.sh` | `scripts/test/core/test-all.sh` |
| `scripts/test/test-complete.sh` | `scripts/test/core/test-complete.sh` |
| `scripts/test/run-tests.sh` | `scripts/test/core/run-tests.sh` |
| `scripts/test/local-test.sh` | `scripts/test/core/local-test.sh` |

### Functional（功能测试）

| 旧路径 | 新路径 |
|--------|--------|
| `scripts/test/test-api-endpoints.sh` | `scripts/test/functional/test-api-endpoints.sh` |
| `scripts/test/test-auth-edge-cases.sh` | `scripts/test/functional/test-auth-edge-cases.sh` |
| `scripts/test/test-auth-session.sh` | `scripts/test/functional/test-auth-session.sh` |
| `scripts/test/test-login-flow.sh` | `scripts/test/functional/test-login-flow.sh` |
| `scripts/test/test-password-flow.sh` | `scripts/test/functional/test-password-flow.sh` |
| `scripts/test/test-user-init-password.sh` | `scripts/test/functional/test-user-init-password.sh` |
| `scripts/test/test-account-creation-flow.sh` | `scripts/test/functional/test-account-creation-flow.sh` |
| `scripts/test/test-business-logic.sh` | `scripts/test/functional/test-business-logic.sh` |
| `scripts/test/test-full-features.sh` | `scripts/test/functional/test-full-features.sh` |
| `scripts/test/test-edge-cases.sh` | `scripts/test/functional/test-edge-cases.sh` |
| `scripts/test/test-user-experience.sh` | `scripts/test/functional/test-user-experience.sh` |
| `scripts/test/test-upload-and-processing.sh` | `scripts/test/functional/test-upload-and-processing.sh` |
| `scripts/test/test-useauth-logic.sh` | `scripts/test/functional/test-useauth-logic.sh` |
| `scripts/test/test-frontend-backend-match.sh` | `scripts/test/functional/test-frontend-backend-match.sh` |
| `scripts/test/test-deployment-flow.sh` | `scripts/test/functional/test-deployment-flow.sh` |
| `scripts/test/test-ai-retouch-global-disable.sh` | `scripts/test/functional/test-ai-retouch-global-disable.sh` |
| `scripts/test/test-360.sh` | `scripts/test/functional/test-360.sh` |

### Component（组件测试）

| 旧路径 | 新路径 |
|--------|--------|
| `scripts/test/test-components.sh` | `scripts/test/component/test-components.sh` |
| `scripts/test/test-component-reliability.sh` | `scripts/test/component/test-component-reliability.sh` |

### Performance（性能测试）

| 旧路径 | 新路径 |
|--------|--------|
| `scripts/test/test-database-performance.sh` | `scripts/test/performance/test-database-performance.sh` |
| `scripts/test/test-high-concurrency.sh` | `scripts/test/performance/test-high-concurrency.sh` |
| `scripts/test/test-image-loading-and-cache.sh` | `scripts/test/performance/test-image-loading-and-cache.sh` |

### Check（检查工具）

| 旧路径 | 新路径 |
|--------|--------|
| `scripts/test/check-frontend-permissions.sh` | `scripts/test/check/check-frontend-permissions.sh` |
| `scripts/test/check-permission-coverage.sh` | `scripts/test/check/check-permission-coverage.sh` |
| `scripts/test/check-test-status.sh` | `scripts/test/check/check-test-status.sh` |

### Utils（工具脚本）

| 旧路径 | 新路径 |
|--------|--------|
| `scripts/test/start-and-test.sh` | `scripts/test/utils/start-and-test.sh` |
| `scripts/test/test-browser-compat.sh` | `scripts/test/utils/test-browser-compat.sh` |
| `scripts/test/test-mobile.sh` | `scripts/test/utils/test-mobile.sh` |
| `scripts/test/test-e2e.sh` | `scripts/test/utils/test-e2e.sh` |
| `scripts/test/test-container-communication.sh` | `scripts/test/utils/test-container-communication.sh` |

## ✅ 已更新的文件

以下文件中的路径引用已自动更新：

- ✅ `package.json` - npm scripts
- ✅ `scripts/test/core/*.sh` - 核心测试脚本
- ✅ `scripts/test/utils/start-and-test.sh` - 启动测试脚本
- ✅ `scripts/test/check/check-test-status.sh` - 状态检查脚本
- ✅ `scripts/README.md` - 脚本总览文档

## 🔍 需要手动更新的地方

如果您在其他地方（如 CI/CD 配置、文档、其他脚本）引用了旧的测试脚本路径，请手动更新：

### GitHub Actions / CI 配置

```yaml
# 旧配置
- run: bash scripts/test/test-api-endpoints.sh

# 新配置
- run: bash scripts/test/functional/test-api-endpoints.sh
```

### 文档中的引用

```markdown
<!-- 旧引用 -->
bash scripts/test/test-components.sh

<!-- 新引用 -->
bash scripts/test/component/test-components.sh
```

### 其他脚本

如果您的自定义脚本中引用了测试脚本，请更新路径。

## 📝 使用建议

### 推荐使用 npm scripts

为了保持兼容性，建议使用 `package.json` 中定义的 npm scripts：

```bash
# 快速验证
pnpm test:quick

# 集成测试
pnpm test:integration

# 组件测试
pnpm test:components

# E2E 测试
pnpm test:e2e
```

### 直接调用脚本

如果需要直接调用脚本，请使用新路径：

```bash
# 核心测试
bash scripts/test/core/comprehensive-test.sh

# 功能测试
bash scripts/test/functional/test-api-endpoints.sh

# 组件测试
bash scripts/test/component/test-components.sh
```

## 🆘 问题排查

如果遇到 "脚本未找到" 错误：

1. 检查脚本路径是否正确
2. 确认脚本文件存在：`ls scripts/test/[category]/[script-name].sh`
3. 检查脚本权限：`chmod +x scripts/test/[category]/[script-name].sh`

## 📚 相关文档

- [测试脚本 README](./README.md) - 测试脚本使用指南
- [测试文档](../../docs/testing/README.md) - 测试文档索引

---

**最后更新**: 2026-02-06
