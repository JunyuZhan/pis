# 测试文档目录

本目录包含所有测试相关的文档和指南。

## 📁 文档列表

### 📖 主要文档

- **[TESTING_GUIDE.md](./TESTING_GUIDE.md)** - 完整测试指南
  - 详细的测试流程和步骤
  - 测试层次结构说明
  - 业务逻辑测试详解
  - 测试报告解读

- **[HOW_TO_TEST.md](./HOW_TO_TEST.md)** - 快速参考指南
  - 快速开始步骤
  - 测试层次说明
  - 常见测试场景
  - 问题排查

- **[TESTING.md](./TESTING.md)** - 测试配置和说明
  - 测试环境配置
  - 测试工具使用
  - 测试最佳实践

### 📊 分析和报告

- **[TEST_COVERAGE_ANALYSIS.md](./TEST_COVERAGE_ANALYSIS.md)** - 测试覆盖率分析
  - 覆盖率统计
  - 覆盖情况分析
  - 改进建议

- **[TESTING_GUIDE_REVIEW.md](./TESTING_GUIDE_REVIEW.md)** - 测试指南审查
  - 指南审查记录
  - 改进建议

## 🚀 快速开始

### 新用户

1. 阅读 [HOW_TO_TEST.md](./HOW_TO_TEST.md) 了解快速开始
2. 运行快速验证: `pnpm test:quick`
3. 查看 [TESTING_GUIDE.md](./TESTING_GUIDE.md) 了解详细流程

### 开发者

1. 查看 [TESTING.md](./TESTING.md) 了解测试配置
2. 运行相关测试脚本（见 `scripts/test/README.md`）
3. 查看覆盖率报告: [TEST_COVERAGE_ANALYSIS.md](./TEST_COVERAGE_ANALYSIS.md)

## 📚 相关资源

- **测试脚本**: `scripts/test/` - 所有测试脚本
- **测试报告**: `reports/test-reports/` - 测试执行报告
- **单元测试**: 代码中的 `.test.ts` 和 `.test.tsx` 文件
- **E2E 测试**: `e2e/` 目录

## 🔗 外部链接

- [Playwright 文档](https://playwright.dev/)
- [Vitest 文档](https://vitest.dev/)
- [测试脚本 README](../../scripts/test/README.md)

---

**最后更新**: 2026-02-06
