# 系统设置实现检查报告

## 一、后台设置项清单

### 1. 品牌信息（Brand）
- ✅ `brand_name` - 品牌名称
- ✅ `brand_tagline` - 品牌标语
- ✅ `logo_url` - Logo 图片 URL
- ✅ `favicon_url` - Favicon URL
- ✅ `copyright_text` - 版权声明
- ✅ `icp_number` - ICP 备案号
- ✅ `police_number` - 公安备案号

### 2. 站点设置（Site）
- ✅ `site_title` - 站点标题
- ✅ `site_description` - 站点描述
- ✅ `site_keywords` - SEO 关键词

### 3. 功能开关（Feature）
- ⚠️ `allow_public_home` - 允许游客访问首页（**未实现**）
- ⚠️ `default_watermark_enabled` - 新相册默认启用水印（**未使用**）
- ⚠️ `default_allow_download` - 新相册默认允许下载（**未使用**）
- ⚠️ `default_show_exif` - 新相册默认显示 EXIF（**未使用**）
- ⚠️ `polling_interval` - 实时更新间隔（**部分使用**，仅环境变量）

### 4. 联系方式（Social）
- ✅ `social_email` - 联系邮箱
- ✅ `social_phone` - 联系电话
- ✅ `wechat_qrcode_url` - 微信二维码
- ✅ `social_weibo` - 微博链接
- ✅ `social_instagram` - Instagram 链接

### 5. 主题设置（Theme）
- ✅ `theme_mode` - 主题模式（立即生效）
- ✅ `theme_primary_color` - 主色调（立即生效）
- ✅ `theme_border_radius` - 圆角大小（立即生效）

## 二、前端使用情况

### ✅ 已实现并使用的设置

1. **品牌信息**
   - `brand_name`: 在页脚显示（site-footer.tsx, album-footer.tsx）
   - `copyright_text`: 在页脚显示
   - `icp_number`: 在页脚显示
   - `police_number`: 在页脚显示
   - `logo_url`: ❌ **未在首页 header 使用**（仍使用环境变量）
   - `favicon_url`: ✅ 在 layout.tsx 的 metadata 中使用

2. **站点设置**
   - `site_title`: ✅ 在 layout.tsx 的 metadata 中使用
   - `site_description`: ✅ 在 layout.tsx 的 metadata 中使用
   - `site_keywords`: ⚠️ **未在 metadata 中使用**

3. **联系方式**
   - ✅ 所有联系方式都在页脚显示（site-footer.tsx, album-footer.tsx）

4. **主题设置**
   - ✅ 所有主题设置都立即生效（通过 ThemeProvider）

### ❌ 未实现或未使用的设置

1. **`allow_public_home`** - 允许游客访问首页
   - 状态：后台可设置，但前端未实现访问控制
   - 位置：应该在 middleware.ts 或首页组件中检查

2. **`default_watermark_enabled`** - 新相册默认启用水印
   - 状态：创建相册时未使用此默认值
   - 位置：apps/web/src/app/api/admin/albums/route.ts 第 240 行

3. **`default_allow_download`** - 新相册默认允许下载
   - 状态：创建相册时使用硬编码的 `true`，未使用设置
   - 位置：apps/web/src/app/api/admin/albums/route.ts 第 236 行

4. **`default_show_exif`** - 新相册默认显示 EXIF
   - 状态：创建相册时使用硬编码的 `true`，未使用设置
   - 位置：apps/web/src/app/api/admin/albums/route.ts 第 238 行

5. **`polling_interval`** - 实时更新间隔
   - 状态：仅在环境变量中使用，未从数据库读取
   - 位置：apps/web/src/hooks/use-photo-realtime.ts

6. **`logo_url`** - Logo URL
   - 状态：首页 header 未使用设置中的 logo
   - 位置：apps/web/src/components/home/header.tsx 第 15-18 行

7. **`brand_name`** - 品牌名称
   - 状态：首页 header 显示硬编码的 "PIS"，未使用设置
   - 位置：apps/web/src/components/home/header.tsx 第 35 行

8. **`brand_tagline`** - 品牌标语
   - 状态：首页 header 未使用设置中的标语
   - 位置：apps/web/src/components/home/header.tsx

## 三、设置更新后前端刷新问题

### 当前问题
- ❌ 后台保存设置后，前台 `SettingsProvider` **不会自动刷新**
- ❌ 前台设置只在组件挂载时获取一次
- ✅ 主题设置会立即生效（通过 ThemeProvider 同步）

### 解决方案
需要在后台保存设置后，触发前台设置的刷新机制。

## 四、修复状态

### ✅ 已修复
1. ✅ **设置保存后前台自动刷新** - 通过自定义事件 `settings-updated` 触发刷新
2. ✅ **创建相册时使用默认设置** - 从数据库读取 `default_watermark_enabled`、`default_allow_download`、`default_show_exif`
3. ✅ **首页 header 使用设置中的 logo 和品牌名称** - 已更新使用 `useSettings` hook
4. ✅ **添加 `site_keywords` 到 metadata** - 已在 layout.tsx 中添加

### ⚠️ 待修复
1. ⚠️ **`allow_public_home` 访问控制** - 需要在 middleware.ts 或首页组件中实现
2. ⚠️ **`polling_interval` 从数据库读取** - 当前仅从环境变量读取，需要改为从数据库读取

## 五、设置更新机制

### 前台刷新机制
- ✅ 后台保存设置后，会触发 `settings-updated` 自定义事件
- ✅ 前台 `SettingsProvider` 监听此事件并自动刷新设置
- ✅ 主题设置会立即生效（通过 ThemeProvider 同步）

### 设置缓存
- ⚠️ 服务端 `getPublicSettings()` 有 60 秒缓存（代码注释，但未实现）
- ✅ 前台客户端设置会在保存后立即刷新
