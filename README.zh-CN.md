# 📸 PIS — 私有化即时摄影分享

[![GitHub stars](https://img.shields.io/github/stars/JunyuZhan/pis?style=social)](https://github.com/JunyuZhan/pis)

面向摄影师与工作室的**自托管照片交付系统**：支持相机 **FTP 直传**、图片处理（缩略图、水印、风格预设）、**带权限的相册**及管理后台。技术栈：**Next.js**、**PostgreSQL**、**MinIO**、**Redis**、**Worker（BullMQ + Sharp）**、**Nginx**，可用 **Docker Compose** 一键编排。

[中文](README.zh-CN.md) · [English](README.md)

## 功能概览

- 相机 **FTP** 上传 · Web 端批量与分片上传  
- **角色权限**（管理员、摄影师、修图师、查看者）、相册密码与过期时间  
- **水印**、风格预设、EXIF 处理（如去除 GPS 保护隐私）  
- 数据**自托管**；生产环境可选用 Docker Secrets 等安全编排  

## 快速开始

**克隆仓库后交互部署**

```bash
git clone https://github.com/JunyuZhan/pis.git
cd pis/docker
bash deploy.sh
```

**一键安装脚本**（可按需安装 Docker、生成密钥并启动）

```bash
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash
```

国内镜像示例：`curl -sSL https://ghproxy.com/https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash`

**使用已构建的 web / worker 镜像部署**（私有仓库或 Docker Hub + `docker/` 目录，目标机不再构建应用镜像）：见 **[docker/README.md](docker/README.md)**、**[docker/DOCKER_COMPOSE_FILES.md](docker/DOCKER_COMPOSE_FILES.md)**，配置 `.env` 后在 `docker` 目录执行 `bash start-from-registry.sh` 等。构建机可同时推多仓库：`bash docker/push-images-to-registries.sh`（见 `DOCKER_COMPOSE_FILES.md`「多 Registry 推送」）。

默认 Docker 方案常通过 **8088**（Nginx）对外访问。完整说明见 **[部署指南](docs/i18n/zh-CN/DEPLOYMENT.md)**。

## 文档

| 说明 | 链接 |
|------|------|
| 部署 | [docs/i18n/zh-CN/DEPLOYMENT.md](docs/i18n/zh-CN/DEPLOYMENT.md) |
| Docker / Compose / 镜像 | [docker/README.md](docker/README.md) |
| 开发 | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| 使用指南 | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| 架构与原理 | [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| 文档索引 | [docs/README.md](docs/README.md) |

## 参与贡献

欢迎 Issue 与 Pull Request，请先阅读 **[CONTRIBUTING.md](docs/project/CONTRIBUTING.md)**。

## 许可证

**MIT** — 见 [LICENSE](LICENSE)。Copyright © 2026 junyuzhan。

## 联系

- GitHub：[JunyuZhan/pis](https://github.com/JunyuZhan/pis) · [@junyuzhan](https://github.com/junyuzhan)  
- 邮箱：junyuzhan@outlook.com  
