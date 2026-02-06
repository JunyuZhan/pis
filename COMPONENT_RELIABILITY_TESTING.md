# 前端组件可靠性测试指南

## 📋 概述

本文档描述了前端组件可靠性测试的实施情况和使用方法。

## ✅ 已完成的测试

### 核心组件测试

我们为核心组件创建了全面的可靠性测试：

1. **Sidebar 组件** (`sidebar.test.tsx`)
   - ✅ 用户信息显示
   - ✅ 角色权限过滤
   - ✅ 导航菜单渲染
   - ✅ 登出功能
   - ✅ 错误处理

2. **ChangePasswordForm 组件** (`change-password-form.test.tsx`)
   - ✅ 表单字段渲染
   - ✅ 密码显示/隐藏切换
   - ✅ 表单验证（必填、长度、确认匹配）
   - ✅ API 提交
   - ✅ 错误处理
   - ✅ 加载状态
   - ✅ 成功状态

3. **AlbumList 组件** (`album-list.test.tsx`)
   - ✅ 相册列表渲染
   - ✅ 空状态显示
   - ✅ 筛选功能
   - ✅ 批量选择模式
   - ✅ 批量删除
   - ✅ 创建相册对话框
   - ✅ 刷新功能

4. **AlbumClient 组件** (`album-client.test.tsx`)
   - ✅ 照片网格渲染
   - ✅ 空状态显示
   - ✅ 加载状态
   - ✅ 无限滚动加载更多
   - ✅ 新照片通知
   - ✅ 刷新功能
   - ✅ 人脸搜索功能

## 🚀 使用方法

### 运行所有组件测试

```bash
# 运行所有组件测试
pnpm test:components

# 运行组件可靠性测试并生成报告
pnpm test:components:reliability
```

### 运行特定组件测试

```bash
# 在 apps/web 目录下
cd apps/web

# 运行特定组件的测试
pnpm test src/components/admin/sidebar.test.tsx

# 监听模式（开发时使用）
pnpm test:watch src/components/admin
```

### 生成覆盖率报告

```bash
cd apps/web
pnpm test:coverage -- src/components
```

覆盖率报告将生成在 `apps/web/coverage` 目录下。

## 📊 测试覆盖率目标

- **语句覆盖率**: ≥ 90%
- **函数覆盖率**: ≥ 90%
- **分支覆盖率**: ≥ 80%
- **行覆盖率**: ≥ 90%

## 🎯 测试重点

### 1. 错误处理测试
- 网络错误处理
- API 错误响应处理
- 边界条件测试
- 异常输入处理

### 2. 用户交互测试
- 表单提交验证
- 按钮点击事件
- 键盘导航
- 触摸手势支持

### 3. 状态管理测试
- 加载状态
- 错误状态
- 成功状态
- 空状态

### 4. 权限控制测试
- 角色过滤
- 权限检查
- 访问控制

## 📝 测试报告

运行 `pnpm test:components:reliability` 后，会在 `reports/component-reliability/` 目录下生成详细的测试报告，包括：

- 测试状态摘要
- 代码覆盖率统计
- 已测试/未测试组件列表
- 测试日志

## 🔧 测试工具

- **Vitest**: 测试运行器
- **React Testing Library**: React 组件测试工具
- **@testing-library/user-event**: 用户交互模拟
- **@testing-library/jest-dom**: DOM 断言扩展

## 📚 测试最佳实践

### 1. 测试命名
使用描述性的测试名称，清晰说明测试的内容：

```typescript
it('应该在提交时显示加载状态', async () => {
  // ...
})
```

### 2. 测试结构
遵循 AAA 模式（Arrange-Act-Assert）：

```typescript
it('应该验证密码确认匹配', async () => {
  // Arrange: 准备测试数据
  const user = userEvent.setup()
  render(<ChangePasswordForm />)
  
  // Act: 执行操作
  await user.type(screen.getByPlaceholderText('请输入当前密码'), 'oldpass123')
  await user.type(screen.getByPlaceholderText('至少8个字符'), 'newpass123')
  await user.type(screen.getByPlaceholderText('请再次输入新密码'), 'different123')
  await user.click(screen.getByRole('button', { name: /修改密码/i }))
  
  // Assert: 验证结果
  await waitFor(() => {
    expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument()
  })
})
```

### 3. Mock 策略
- Mock 外部依赖（API、路由等）
- 使用 `vi.mock()` 进行模块级别的 mock
- 在 `beforeEach` 中重置 mock 状态

### 4. 异步测试
使用 `waitFor` 处理异步更新：

```typescript
await waitFor(() => {
  expect(screen.getByText('密码修改成功')).toBeInTheDocument()
})
```

## 🔍 待测试组件

以下组件尚未创建测试文件，建议优先测试：

### Admin 组件
- `ai-retouch-settings.tsx`
- `create-user-dialog.tsx`
- `user-list.tsx`
- `user-detail-client.tsx`
- `retouch-dashboard.tsx`
- `mobile-sidebar.tsx`
- `mobile-bottom-nav.tsx`
- `photo-group-manager.tsx`
- `poster-config-dialog.tsx`
- `scan-sync-button.tsx`
- `share-link-button.tsx`
- `style-preset-selector.tsx`
- `upgrade-manager.tsx`
- `watermark-preview.tsx`

### Album 组件
- `album-header.tsx`
- `album-footer.tsx`
- `album-hero.tsx`
- `album-info-bar.tsx`
- `album-share-button.tsx`
- `album-splash-screen.tsx`
- `album-sticky-nav.tsx`
- `face-search-modal.tsx`
- `floating-actions.tsx`
- `layout-toggle.tsx`
- `photo-group-filter.tsx`
- `sort-toggle.tsx`
- `lightbox-error-boundary.tsx`

### UI 组件
- `language-switcher.tsx`
- `optimized-image.tsx`
- `skeleton.tsx`
- `long-press-menu.tsx`
- `pull-to-refresh.tsx`
- `dropdown-menu.tsx`
- `visually-hidden.tsx`

### Home 组件
- `header.tsx`
- `home-hero.tsx`
- `works-section.tsx`
- `album-grid.tsx`

## 📖 相关文档

- [Vitest 文档](https://vitest.dev/)
- [React Testing Library 文档](https://testing-library.com/react)
- [测试配置](./apps/web/vitest.config.ts)
- [测试工具](./apps/web/src/test/)

## 🐛 故障排除

### 测试运行失败

1. **检查依赖**: 确保所有依赖已安装
   ```bash
   pnpm install
   ```

2. **清理缓存**: 清理测试缓存
   ```bash
   cd apps/web
   rm -rf node_modules/.vite
   ```

3. **检查 Mock**: 确保所有必要的模块都已正确 mock

### 覆盖率报告未生成

确保已安装覆盖率工具：
```bash
cd apps/web
pnpm add -D @vitest/coverage-v8
```

## 📞 支持

如有问题，请查看：
- 测试日志: `reports/component-reliability/test_output.log`
- 测试报告: `reports/component-reliability/report_*.md`

---

**最后更新**: 2026-02-06
