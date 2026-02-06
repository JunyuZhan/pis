# 🔧 PIS 认证系统修复记录

**修复时间**: 2026-02-06  
**修复范围**: 登录/登出逻辑、会话管理、意外登出问题

---

## ✅ 已修复的问题

### 1. **useAuth Hook 的错误处理** ✅ **已修复**

**文件**: `apps/web/src/hooks/use-auth.ts`

**问题**:
- 网络错误时错误地清除用户状态
- 导致用户在网络不稳定时被意外登出

**修复内容**:
```typescript
// 修复前
try {
  const res = await fetch('/api/auth/me')
  const data = await res.json()
  setUser(data.user)
} catch {
  setUser(null)  // ❌ 任何错误都清除用户状态
}

// 修复后
try {
  const res = await fetch('/api/auth/me')
  
  if (!res.ok) {
    // ✅ 只有明确返回 401/403 时才清除用户状态（认证失败）
    if (res.status === 401 || res.status === 403) {
      setUser(null)
    }
    // ✅ 其他错误（500、网络错误等）不改变用户状态
    return
  }
  
  const data = await res.json()
  setUser(data.user)
} catch (error) {
  // ✅ 网络错误时不改变用户状态，只记录日志
  console.warn('[useAuth] Failed to fetch user, but keeping current state:', error)
  // ✅ 不设置 setUser(null)，保持当前状态
}
```

**修复效果**:
- ✅ 网络错误不会导致意外登出
- ✅ 只有明确认证失败（401/403）时才清除用户状态
- ✅ 用户体验更好，系统更稳定

---

## 📋 待修复的问题（可选）

### 2. **清理未使用的中间件实现** ⏳ **待处理**

**文件**:
- `apps/web/src/lib/supabase/middleware.ts` - Supabase 中间件（可能未使用）
- `apps/web/src/lib/auth/compat.ts` - 兼容层中间件（可能未使用）

**建议**:
- 确认当前使用的中间件（应该是 `lib/auth/middleware.ts`）
- 删除或标记未使用的中间件实现
- 添加注释说明使用哪个中间件

**优先级**: 中

---

### 3. **API Routes 中的 Token 刷新** ⏳ **待优化**

**文件**: `apps/web/src/lib/auth/jwt-helpers.ts`

**问题**:
- API Routes 中检测到 refresh token 有效但 access token 无效时，返回用户信息但不设置新的 cookie
- 可能导致后续请求失败

**当前状态**:
- 中间件已经处理了 token 刷新（`/api/admin/*` 路径）
- 影响较小，因为只有 admin API 需要认证

**建议**:
- 当前实现是合理的
- 如果未来有其他需要认证的 API 路由，需要添加到中间件

**优先级**: 低

---

## 🧪 测试建议

### 1. 网络错误场景测试

```bash
# 测试步骤：
# 1. 登录系统
# 2. 断开网络连接
# 3. 等待 5 分钟（useAuth 检查间隔）
# 4. 检查是否被意外登出（应该不会）
# 5. 恢复网络连接
# 6. 检查是否能正常访问（应该可以）
```

### 2. Token 过期场景测试

```bash
# 测试步骤：
# 1. 登录系统
# 2. 手动修改 access token cookie，使其过期
# 3. 访问 admin 页面
# 4. 检查是否自动刷新 token（应该会）
# 5. 检查是否能正常访问（应该可以）
```

### 3. 认证失败场景测试

```bash
# 测试步骤：
# 1. 登录系统
# 2. 手动删除所有认证 cookie
# 3. 访问 admin 页面
# 4. 检查是否重定向到登录页（应该会）
```

---

## 📊 修复前后对比

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 网络错误 | ❌ 用户被意外登出 | ✅ 保持登录状态 |
| 服务器错误 (500) | ❌ 用户被意外登出 | ✅ 保持登录状态 |
| 认证失败 (401/403) | ✅ 正确登出 | ✅ 正确登出 |
| Token 过期 | ✅ 自动刷新 | ✅ 自动刷新 |

---

## ✅ 修复验证

### 验证步骤

1. **基础功能测试**
   ```bash
   bash scripts/test/test-auth-session.sh
   ```

2. **手动测试**
   - 登录系统
   - 模拟网络错误（断开网络）
   - 等待 5 分钟
   - 检查是否被意外登出（应该不会）
   - 恢复网络
   - 检查是否能正常访问（应该可以）

3. **Token 刷新测试**
   - 登录系统
   - 手动修改 access token cookie，使其过期
   - 访问 admin 页面
   - 检查是否自动刷新 token（应该会）

---

## 📝 相关文件

- ✅ `apps/web/src/hooks/use-auth.ts` - **已修复**
- `apps/web/src/lib/auth/jwt-helpers.ts` - Token 刷新逻辑
- `apps/web/src/lib/auth/middleware.ts` - 认证中间件
- `apps/web/src/middleware.ts` - Next.js 中间件
- `apps/web/src/app/admin/(dashboard)/layout.tsx` - Admin Layout

---

**最后更新**: 2026-02-06
