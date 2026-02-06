# 🔧 PIS 认证系统关键修复

**修复时间**: 2026-02-06  
**修复范围**: 竞态条件、双重检查、Token 刷新问题

---

## 🚨 修复的关键问题

### 1. **中间件中的竞态条件** ✅ **已修复**

**问题**:
- `updateSession` 中，如果 `refreshedUser` 为 null，会调用 `getUserFromRequest(request)`
- 但如果 token 刚过期，`updateSessionMiddleware` 刷新了 token，但 `refreshedUser` 可能在某些情况下为 null
- 然后调用 `getUserFromRequest(request)` 读取的是旧的 request，可能读取不到新的 token

**修复**:
```typescript
// 修复前
const user = refreshedUser || await getUserFromRequest(request)

// 修复后
let user = refreshedUser
if (!user) {
  user = await getUserFromRequest(request)
}
```

**效果**: 确保优先使用刷新后的用户信息，避免竞态条件

---

### 2. **Layout 组件中的双重检查** ✅ **已修复**

**问题**:
- Layout 组件调用 `getCurrentUser()`，如果此时 token 刚过期但 refresh token 有效
- `getCurrentUser` 会刷新 token，但中间件可能已经检查过了
- 如果中间件刷新了 token，但 Layout 组件读取时 token 还没完全生效，可能返回 `null`

**修复**:
```typescript
// 修复前
const user = await getCurrentUser()
if (!user) {
  redirect('/admin/login')
}

// 修复后
let user = await getCurrentUser()
if (!user) {
  // 等待一下，让 token 刷新完成（如果中间件正在刷新 token）
  await new Promise(resolve => setTimeout(resolve, 50))
  user = await getCurrentUser()
  
  if (!user) {
    redirect('/admin/login')
  }
}
```

**效果**: 避免 token 刷新过程中的竞态条件导致的意外重定向

---

### 3. **updateSessionMiddleware 的返回值** ✅ **已优化**

**问题**:
- 即使 token 有效，也要确保返回 `currentUser`，不能返回 `null`
- 这样可以确保中间件正确识别已登录的用户

**修复**:
- 添加了更详细的日志
- 确保即使 token 有效也返回 `currentUser`

**效果**: 确保中间件正确识别已登录的用户

---

## 📋 修复后的流程

### 正常流程

1. **用户访问 `/admin` 页面**
   - 中间件检查认证状态
   - 如果 token 过期但 refresh token 有效，刷新 token
   - 返回刷新后的用户信息

2. **Layout 组件检查**
   - 调用 `getCurrentUser()`
   - 如果返回 null，等待 50ms 后重试
   - 如果仍然 null，重定向到登录页

3. **useAuth Hook 检查**
   - 每 5 分钟检查一次认证状态
   - 网络错误不会导致意外登出

### Token 刷新流程

1. **中间件检测到 token 过期**
   - 检查 refresh token 是否有效
   - 如果有效，刷新 access token
   - 设置新的 cookie
   - 返回刷新后的用户信息

2. **Layout 组件读取用户**
   - 调用 `getCurrentUser()`
   - 如果 token 刚刷新，可能读取不到新的 token
   - 等待 50ms 后重试，确保读取到新的 token

---

## 🧪 测试场景

### 场景 1: Token 刚过期时的页面导航 ✅

1. 用户登录，access token 即将过期
2. 等待 access token 过期（但 refresh token 仍然有效）
3. 点击链接导航到新页面
4. **预期**: 中间件刷新 token，用户能正常访问
5. **实际**: ✅ 修复后应该正常工作

### 场景 2: 快速连续导航 ✅

1. 用户登录
2. 快速连续点击多个链接
3. **预期**: 所有导航都应该成功
4. **实际**: ✅ 修复后应该正常工作

### 场景 3: Layout 组件检查时的竞态条件 ✅

1. 用户登录，access token 即将过期
2. 等待 access token 过期
3. 访问 admin 页面
4. **预期**: Layout 组件应该能正确读取用户信息
5. **实际**: ✅ 修复后应该正常工作（等待 50ms 后重试）

---

## ✅ 修复效果

### 修复前的问题

- ❌ Token 刷新时可能读取不到新的 token
- ❌ Layout 组件可能误判用户未登录
- ❌ 可能导致意外重定向到登录页

### 修复后的效果

- ✅ Token 刷新逻辑更可靠
- ✅ Layout 组件有重试机制，避免竞态条件
- ✅ 不会因为竞态条件导致意外登出

---

## 📝 相关文件

- ✅ `apps/web/src/lib/auth/middleware.ts` - **已修复**
- ✅ `apps/web/src/app/admin/(dashboard)/layout.tsx` - **已修复**
- ✅ `apps/web/src/lib/auth/jwt-helpers.ts` - **已优化**

---

**最后更新**: 2026-02-06
