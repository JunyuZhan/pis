# 测试文档目录

本目录包含所有测试相关的文档和指南。

## 📁 文档列表

### 📖 主要文档

- **[TESTING.md](./TESTING.md)** - 完整测试指南
  - 快速开始和前置条件
  - 测试层次结构（单元测试、集成测试、E2E 测试）
  - 运行测试的方法和命令
  - 测试脚本说明
  - 测试报告解读
  - 调试和常见问题

### 📊 分析和报告

- **[TEST_COVERAGE_ANALYSIS.md](./TEST_COVERAGE_ANALYSIS.md)** - 测试覆盖率分析
  - 覆盖率统计
  - 覆盖情况分析
  - 改进建议

## 🚀 快速开始

### 新用户

1. 阅读 [TESTING.md](./TESTING.md) 了解快速开始
2. 运行快速验证: `pnpm test:quick`
3. 运行完整测试: `bash scripts/test/comprehensive-test.sh`

### 开发者

1. 查看 [TESTING.md](./TESTING.md) 了解测试配置和详细流程
2. 运行相关测试脚本（见 `scripts/test/README.md`）
3. 查看覆盖率报告: [TEST_COVERAGE_ANALYSIS.md](./TEST_COVERAGE_ANALYSIS.md)

## 📚 相关资源

- **测试脚本**: `scripts/test/` - 所有测试脚本
- **单元测试**: 代码中的 `.test.ts` 和 `.test.tsx` 文件
- **E2E 测试**: `e2e/` 目录

## 🔗 外部链接

- [Playwright 文档](https://playwright.dev/)
- [Vitest 文档](https://vitest.dev/)
- [测试脚本 README](../../scripts/test/README.md)

---

**最后更新**: 2026-02-07
