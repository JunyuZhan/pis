# AI 修图全局关闭功能修复报告

## 问题描述

用户询问 AI 修图是否全局可关闭，需要测试并修复。

## 发现的问题

1. **相册缓存缺少 AI 修图字段**
   - `CachedAlbum` 接口未包含 `enable_ai_retouch` 和 `ai_retouch_config` 字段
   - 导致 worker 缓存可能不包含最新的 AI 修图设置

2. **Worker 缓存更新不完整**
   - Worker 在更新缓存时只保存了部分字段（水印、风格预设等）
   - 未保存 `enable_ai_retouch` 和 `ai_retouch_config` 字段
   - 导致即使数据库更新了，worker 仍可能使用旧的缓存值

3. **批量更新后未清除缓存**
   - 批量更新 API 更新相册设置后，未清除 worker 的相册缓存
   - 导致 worker 可能继续使用旧的缓存配置，直到缓存过期（默认 5 分钟）

## 修复内容

### 1. 修复相册缓存接口 (`services/worker/src/lib/album-cache.ts`)

```typescript
interface CachedAlbum {
  id: string;
  watermark_enabled: boolean;
  watermark_type: string | null;
  watermark_config: any;
  color_grading?: { preset?: string } | null;
  enable_ai_retouch?: boolean;        // ✅ 新增
  ai_retouch_config?: any;            // ✅ 新增
  cachedAt: number;
}
```

### 2. 修复 Worker 缓存更新逻辑 (`services/worker/src/index.ts`)

```typescript
// 更新缓存（如果是从数据库查询的）
if (!cachedAlbum && CONFIG.ENABLE_ALBUM_CACHE) {
  albumCache.set(albumId, {
    id: albumData.id,
    watermark_enabled: albumData.watermark_enabled,
    watermark_type: albumData.watermark_type,
    watermark_config: albumData.watermark_config,
    color_grading: albumData.color_grading,
    enable_ai_retouch: albumData.enable_ai_retouch,      // ✅ 新增
    ai_retouch_config: albumData.ai_retouch_config,        // ✅ 新增
  });
}
```

### 3. 添加批量更新后清除缓存逻辑 (`apps/web/src/app/api/admin/albums/batch/route.ts`)

```typescript
// 如果更新了 enable_ai_retouch，清除相关相册的 worker 缓存
if (updates.enable_ai_retouch !== undefined) {
  try {
    const workerUrl = getInternalApiUrl('/api/worker/clear-album-cache')
    const cookieHeader = request.headers.get('cookie')
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }
    
    // 并行清除所有相册的缓存
    await Promise.allSettled(
      albumIds.map(async (albumId) => {
        try {
          const response = await fetch(workerUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ albumId }),
          })
          if (!response.ok) {
            console.warn(`Failed to clear cache for album ${albumId}: ${response.status}`)
          }
        } catch (err) {
          console.warn(`Failed to clear cache for album ${albumId}:`, err)
        }
      })
    )
  } catch (err) {
    console.warn('Failed to clear worker cache:', err)
  }
}
```

### 4. 创建测试脚本 (`scripts/test/test-ai-retouch-global-disable.sh`)

测试脚本验证：
- ✅ 全局关闭功能是否正常工作
- ✅ 关闭后相册设置是否正确更新
- ✅ 全局开启功能是否正常工作
- ✅ 开启后相册设置是否正确更新

## 测试方法

运行测试脚本：

```bash
# 设置环境变量（可选）
export BASE_URL=http://localhost:3000
export ADMIN_EMAIL=admin@pis.com
export ADMIN_PASSWORD=admin123

# 运行测试
./scripts/test/test-ai-retouch-global-disable.sh
```

## 功能验证

### 全局关闭流程

1. 管理员登录系统设置页面 (`/admin/settings`)
2. 在 "AI 修图全局设置" 卡片中点击全局开关
3. 系统调用 `PATCH /api/admin/albums/batch` 批量更新所有相册的 `enable_ai_retouch` 为 `false`
4. 更新成功后，清除所有相关相册的 worker 缓存
5. 新上传的照片将不会进行 AI 修图处理

### 全局开启流程

1. 管理员在系统设置页面点击全局开关
2. 系统批量更新所有相册的 `enable_ai_retouch` 为 `true`
3. 清除缓存后，新上传的照片将进行 AI 修图处理

## 技术细节

### 缓存清除机制

- 使用 `Promise.allSettled` 并行清除所有相册的缓存，提高性能
- 清除缓存失败不影响主流程（使用 `try-catch` 包裹）
- 通过 worker 代理 API (`/api/worker/clear-album-cache`) 清除缓存
- 传递认证 cookie 确保请求被正确认证

### Worker 缓存检查

Worker 在处理照片时会：
1. 首先检查相册缓存
2. 如果缓存未命中或过期，从数据库查询相册配置
3. 查询结果会更新缓存（包含 AI 修图设置）
4. 使用 `album?.enable_ai_retouch ?? false` 决定是否启用 AI 修图

## 影响范围

- ✅ 修复后，全局关闭功能可以立即生效
- ✅ 不需要等待缓存过期（5 分钟）
- ✅ 新上传的照片会立即使用最新的相册配置
- ✅ 不影响已处理完成的照片

## 注意事项

1. 清除缓存是异步操作，即使失败也不会影响批量更新的成功
2. Worker 服务必须正常运行，否则清除缓存会失败（但不影响主流程）
3. 如果 worker 服务不可用，缓存会在 5 分钟后自动过期

## 总结

✅ **问题已修复**：AI 修图全局关闭功能现在可以正常工作
✅ **缓存问题已解决**：相册缓存包含完整的 AI 修图配置
✅ **实时生效**：批量更新后立即清除缓存，无需等待过期
✅ **测试脚本已创建**：可以自动化测试全局开关功能
