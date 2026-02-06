# 上传队列配置说明

## 当前配置

### 1. 前端上传队列并发数

**位置**: `apps/web/src/components/admin/photo-uploader.tsx:15`

```typescript
const MAX_CONCURRENT_UPLOADS = 5 // 最大同时上传数量
```

**说明**:
- 前端同时上传的文件数量限制
- 默认值：**5 张**
- 超过此数量的文件会进入等待队列

### 2. Worker 处理队列并发数

**位置**: `services/worker/src/index.ts:214-216`

```typescript
PHOTO_PROCESSING_CONCURRENCY: parseInt(
  process.env.PHOTO_PROCESSING_CONCURRENCY || "5",
),
```

**说明**:
- Worker 同时处理的照片数量限制
- 默认值：**5 张**
- 可通过环境变量 `PHOTO_PROCESSING_CONCURRENCY` 配置

### 3. 测试脚本并发数

**位置**: `scripts/test/test-upload-and-processing.sh:29`

```bash
CONCURRENT_UPLOADS="${CONCURRENT_UPLOADS:-5}"
```

**说明**:
- 测试脚本的并发上传数量
- 默认值：**5 张**
- 可通过环境变量 `CONCURRENT_UPLOADS` 配置

## 配置总结

| 位置 | 配置项 | 默认值 | 可配置 |
|------|--------|--------|--------|
| 前端上传组件 | `MAX_CONCURRENT_UPLOADS` | 5 | 需修改代码 |
| Worker 处理队列 | `PHOTO_PROCESSING_CONCURRENCY` | 5 | 环境变量 |
| 测试脚本 | `CONCURRENT_UPLOADS` | 5 | 环境变量 |

## 如何修改

### 1. 修改前端上传并发数

编辑 `apps/web/src/components/admin/photo-uploader.tsx`:

```typescript
const MAX_CONCURRENT_UPLOADS = 10 // 修改为 10 张
```

### 2. 修改 Worker 处理并发数

在 `.env` 或环境变量中设置：

```bash
PHOTO_PROCESSING_CONCURRENCY=10
```

### 3. 修改测试脚本并发数

运行测试时设置环境变量：

```bash
export CONCURRENT_UPLOADS=10
./scripts/test/test-upload-and-processing.sh
```

## 性能建议

### 推荐配置

| 服务器资源 | 前端并发 | Worker 并发 | 说明 |
|------------|----------|-------------|------|
| 低配置（2核2G） | 3 | 3 | 避免资源耗尽 |
| 中配置（4核4G） | 5 | 5 | 默认配置 |
| 高配置（8核8G+） | 10 | 10 | 提升吞吐量 |

### 注意事项

1. **前端并发数**
   - 受浏览器资源限制
   - 建议不超过 10 张
   - 大文件时建议降低到 3-5 张

2. **Worker 并发数**
   - 受服务器 CPU 和内存限制
   - 每张照片处理需要 ~500MB 内存峰值
   - 建议根据服务器资源调整

3. **队列积压**
   - 如果处理速度慢，队列会积压
   - 建议监控队列长度
   - 设置告警阈值（如 > 100）

## 监控指标

### 关键指标

1. **队列长度**: 等待处理的照片数量
2. **并发使用率**: 当前并发数 / 最大并发数
3. **处理速度**: 照片/秒
4. **平均处理时间**: 秒/张

### 告警阈值

- 队列长度 > 100
- 并发使用率 > 90%
- 平均处理时间 > 60秒

## 当前状态

✅ **前端上传队列**: 5 张并发
✅ **Worker 处理队列**: 5 张并发
✅ **测试脚本**: 5 张并发

所有配置都是 **5 张并发**，这是一个平衡性能和资源使用的合理默认值。
