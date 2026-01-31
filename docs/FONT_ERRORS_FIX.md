# 字体错误修复指南

## 🔍 错误说明

### 1. "Failed to decode downloaded font"
**含义**: 字体文件无法解码，通常是文件损坏或格式不正确

### 2. "OTS parsing error: invalid sfntVersion"
**含义**: OpenType Sanitizer (OTS) 无法解析字体文件，文件格式无效

### 3. "Could not establish connection. Receiving end does not exist"
**含义**: 这是浏览器扩展相关的错误，**不是应用本身的问题**，可以忽略

---

## ✅ 解决方案

### 方案 1: 重新下载字体文件（推荐）

#### 使用脚本自动下载：
```bash
bash scripts/download-fonts-fixed.sh
```

#### 手动下载（如果脚本失败）：

1. **访问 Google Fonts Helper**:
   - https://google-webfonts-helper.herokuapp.com/

2. **下载以下字体**（每个字体需要 3 个权重：400, 600, 700）:
   - **Inter** - 选择 "latin" subset，下载 Regular (400), SemiBold (600), Bold (700)
   - **Noto Serif SC** - 选择 "chinese-simplified" subset，下载 Regular (400), SemiBold (600), Bold (700)
   - **Playfair Display** - 选择 "latin" subset，下载 Regular (400), SemiBold (600), Bold (700)

3. **选择格式**: 选择 **woff2** 格式

4. **放置文件**: 将下载的文件放到 `apps/web/src/app/fonts/` 目录

5. **重命名文件**（如果需要）:
   ```
   Inter-Regular.woff2
   Inter-SemiBold.woff2
   Inter-Bold.woff2
   NotoSerifSC-Regular.woff2
   NotoSerifSC-SemiBold.woff2
   NotoSerifSC-Bold.woff2
   PlayfairDisplay-Regular.woff2
   PlayfairDisplay-SemiBold.woff2
   PlayfairDisplay-Bold.woff2
   ```

### 方案 2: 使用系统字体（临时方案）

如果无法下载字体文件，应用会自动使用 fallback 字体：
- **Inter** → 系统无衬线字体（-apple-system, BlinkMacSystemFont, Segoe UI, Roboto）
- **Noto Serif SC** → 系统中文字体（PingFang SC, Hiragino Sans GB, Microsoft YaHei）
- **Playfair Display** → 系统衬线字体（Georgia, Times New Roman）

**注意**: 使用系统字体会影响视觉效果，但不会影响功能。

---

## 🔧 验证字体文件

检查字体文件大小（正常应该 > 5KB）:
```bash
ls -lh apps/web/src/app/fonts/*.woff2
```

如果文件小于 5KB，说明文件损坏，需要重新下载。

---

## 📝 注意事项

1. **字体文件大小参考**:
   - Inter: ~20-30KB 每个文件
   - Noto Serif SC: ~100-200KB 每个文件（中文字体较大）
   - Playfair Display: ~20-30KB 每个文件

2. **浏览器缓存**: 如果修复后仍有问题，清除浏览器缓存或使用硬刷新（Ctrl+Shift+R / Cmd+Shift+R）

3. **第三个错误可以忽略**: "Could not establish connection" 是浏览器扩展的问题，不影响应用功能

---

## 🚀 修复后重新构建

修复字体文件后，需要重新构建应用：

```bash
# 本地开发
cd apps/web
pnpm build

# Docker 部署
cd docker
docker compose -f docker-compose.standalone.yml build --no-cache web
docker compose -f docker-compose.standalone.yml up -d web
```
