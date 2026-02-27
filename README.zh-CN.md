# 📸 PIS - 私有化即时摄影分享系统

> Private Instant photo Sharing - 专为摄影师打造的私有化照片交付工具

<p align="center">
  <a href="https://github.com/JunyuZhan/pis/stargazers">
    <img src="https://img.shields.io/github/stars/JunyuZhan/pis?style=social" alt="GitHub stars" />
  </a>
</p>

<p align="center">
  <a href="https://star-history.com/#JunyuZhan/pis&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis&type=Date&theme=dark" />
      <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=JunyuZhan/pis&type=Date" />
      <img src="https://api.star-history.com/svg?repos=JunyuZhan/pis&type=Date" alt="Star History Chart" />
    </picture>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/MinIO-Object%20Storage-C72E49?style=flat-square&logo=minio" alt="MinIO" />
  <img src="https://img.shields.io/badge/BullMQ-Redis-FF6B6B?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Sharp-图片处理-99CC00?style=flat-square" alt="Sharp" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

---

## 🌟 核心功能

### ⚡ **即时交付**
- **相机 FTP 直传**: 支持 Sony/Canon 相机通过 FTP 直接上传
- **实时处理**: 分钟级照片交付，自动处理
- **批量上传**: 分片上传支持大文件，拖拽上传

### 🖼️ **高级图片处理**
- **自动处理**: EXIF 旋转，缩略图（400px）和预览图（2560px）生成
- **风格预设**: 13 种专业预设（人像、风景、通用），实时预览
- **水印功能**: 最多 6 个水印（文字和 Logo），9 宫格布局，大小可调
- **隐私保护**: 自动移除 EXIF 中的 GPS 数据

### 🎨 **专业展示**
- **响应式布局**: 瀑布流和网格布局，移动端优化
- **深色模式**: 系统感知主题，自定义主色调
- **灯箱模式**: 键盘导航，全屏查看
- **品牌定制**: Logo、启动页、动态海报

### 🔐 **安全与权限控制**
- **角色权限**: 管理员、摄影师、修图师、查看者角色
- **权限管理**: 细粒度的角色权限控制
- **密码保护**: 相册级密码和过期时间
- **分享链接**: 安全分享，支持二维码和自定义海报

### 🛠️ **系统管理**
- **网页设置**: 无需编辑 `.env` 文件即可配置系统
- **品牌定制**: Logo、Favicon、站点标题、SEO 设置
- **数据备份**: 导出/导入系统数据（JSON 格式）
- **操作日志**: 完整的操作追踪和分析
- **用户管理**: 多用户支持，角色分配
- **翻译管理**: 自定义系统翻译

### 💰 **完全自托管**
- **零外部依赖**: PostgreSQL + MinIO + Redis（全部自托管）
- **Docker 部署**: Docker Compose 一键部署
- **单端口访问**: 统一通过 8088 端口访问（Nginx 反向代理）
- **完全隐私**: 所有数据本地存储，无云服务

---

## 🚀 快速开始

### 一键部署

```bash
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash

# 国内用户（使用代理加速）
curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash
```

**自动完成：**
- ✅ 安装 Docker 和 Docker Compose（如未安装）
- ✅ 自动生成安全密钥
- ✅ 启动所有服务（PostgreSQL + MinIO + Redis + Web + Worker + Nginx）
- ✅ 创建管理员账户（首次登录时设置密码）

### 交互式部署

```bash
git clone https://github.com/JunyuZhan/pis.git
cd pis/docker
bash deploy.sh
```

### 访问应用

| 服务 | 地址 | 说明 |
|------|------|------|
| 首页 | http://localhost:8080 | - |
| 管理后台 | http://localhost:8080/admin/login | 部署脚本创建的管理员账号 |

> 📖 **完整部署指南**: [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md)

---

## 🏗️ 系统架构

**所有服务容器化：**

```
Web (Next.js) → Nginx → Worker (BullMQ + Sharp) → MinIO
                    ↓
              PostgreSQL + Redis
```

**单端口访问（8088）：**
- `/` - 公开首页
- `/admin` - 管理后台
- `/album/[slug]` - 客户端相册页面
- `/api/*` - API 接口
- `/media/*` - 媒体文件（MinIO）

> 📖 **架构详情**: [docs/ARCHITECTURE.example.md](docs/ARCHITECTURE.example.md)

---

## 📖 文档

- **[部署指南](docs/i18n/zh-CN/DEPLOYMENT.md)** - 完整部署说明
- **[开发指南](docs/DEVELOPMENT.md)** - 开发环境搭建和规范
- **[使用指南](docs/USER_GUIDE.md)** - 功能使用说明
- **[架构指南](docs/ARCHITECTURE.example.md)** - 系统架构概览

> 📚 **完整文档**: [docs/README.md](docs/README.md)

---

## 🛠️ 常用命令

```bash
pnpm setup      # 引导式部署
pnpm dev        # 启动开发
pnpm build      # 构建生产版本
pnpm docker:up  # 启动 Docker 服务
pnpm lint       # 运行代码检查
pnpm test       # 运行测试
```

---

## 📄 许可证

MIT License © 2026 junyuzhan

查看 [LICENSE](LICENSE) 文件了解详情。

---

## 👤 作者

**junyuzhan**
- 邮箱: junyuzhan@outlook.com
- GitHub: [@junyuzhan](https://github.com/junyuzhan)

## 🤝 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](docs/project/CONTRIBUTING.md) 了解贡献指南。

---

## 🙏 致谢

基于以下技术构建：[Next.js](https://nextjs.org/) • [PostgreSQL](https://www.postgresql.org/) • [MinIO](https://min.io/) • [Sharp](https://sharp.pixelplumbing.com/) • [Tailwind CSS](https://tailwindcss.com/) • [BullMQ](https://docs.bullmq.io/)
