# 📸 PIS - Private Instant Photo Sharing

> A self-hosted photo delivery system designed for photographers

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
  <img src="https://img.shields.io/badge/Sharp-Image%20Processing-99CC00?style=flat-square" alt="Sharp" />
</p>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <a href="README.md">English</a>
</p>

---

## 🌟 Core Features

### ⚡ **Instant Delivery**
- **Camera FTP Upload**: Direct upload from Sony/Canon cameras via FTP
- **Real-time Processing**: Minutes-level photo delivery with automatic processing
- **Batch Upload**: Multipart upload for large files, drag & drop support

### 🖼️ **Advanced Image Processing**
- **Auto Processing**: EXIF rotation, thumbnail (400px) & preview (2560px) generation
- **Style Presets**: 13 professional presets (portrait, landscape, general) with real-time preview
- **Watermarking**: Up to 6 watermarks (text & logo), 9-position grid, size adjustment
- **Privacy Protection**: Automatic GPS removal from EXIF data

### 🎨 **Professional Presentation**
- **Responsive Layouts**: Masonry & grid layouts, mobile optimized
- **Dark Mode**: System-aware theme with custom primary colors
- **Lightbox**: Keyboard navigation, full-screen viewing
- **Custom Branding**: Logo, splash screens, dynamic posters

### 🔐 **Security & Access Control**
- **Role-Based Access**: Admin, photographer, retoucher, viewer roles
- **Permission Management**: Granular permission control per role
- **Password Protection**: Album-level password and expiration dates
- **Share Links**: Secure sharing with QR codes and custom posters

### 🛠️ **System Management**
- **Web-Based Settings**: Configure system without editing `.env` files
- **Brand Customization**: Logo, favicon, site title, SEO settings
- **Data Backup**: Export/import system data (JSON format)
- **Audit Logs**: Complete operation tracking and analytics
- **User Management**: Multi-user support with role assignment
- **Translation Management**: Customize system translations

### 💰 **Fully Self-Hosted**
- **Zero External Dependencies**: PostgreSQL + MinIO + Redis (all self-hosted)
- **Docker Deployment**: One-click deployment with Docker Compose
- **Single Port**: Unified access via port 8088 (Nginx reverse proxy)
- **Complete Privacy**: All data stored locally, no cloud services

---

## 🚀 Quick Start

### One-Click Deployment

```bash
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash
```

**What it does:**
- ✅ Installs Docker & Docker Compose (if needed)
- ✅ Generates secure secrets automatically
- ✅ Starts all services (PostgreSQL + MinIO + Redis + Web + Worker + Nginx)
- ✅ Creates admin account (password setup on first login)

### Interactive Deployment

```bash
git clone https://github.com/JunyuZhan/pis.git
cd pis/docker
bash deploy.sh
```

### Access

| Service | URL | Credentials |
|---------|-----|-------------|
| Homepage | http://localhost:8080 | - |
| Admin Dashboard | http://localhost:8080/admin/login | Created by deploy script |

> 📖 **Full deployment guide**: [docs/i18n/en/DEPLOYMENT.md](docs/i18n/en/DEPLOYMENT.md)

---

## 🏗️ Architecture

**All Services Containerized:**

```
Web (Next.js) → Nginx → Worker (BullMQ + Sharp) → MinIO
                    ↓
              PostgreSQL + Redis
```

**Single Port Access (8088):**
- `/` - Public homepage
- `/admin` - Admin dashboard
- `/album/[slug]` - Client album pages
- `/api/*` - API endpoints
- `/media/*` - Media files (MinIO)

> 📖 **Architecture details**: [docs/ARCHITECTURE.example.md](docs/ARCHITECTURE.example.md)

---

## 📖 Documentation

- **[Deployment Guide](docs/i18n/en/DEPLOYMENT.md)** - Complete deployment instructions
- **[Development Guide](docs/DEVELOPMENT.md)** - Development setup and guidelines
- **[User Guide](docs/USER_GUIDE.md)** - Feature usage guide
- **[Architecture Guide](docs/ARCHITECTURE.example.md)** - System architecture overview

> 📚 **Full documentation**: [docs/README.md](docs/README.md)

---

## 🛠️ Quick Commands

```bash
pnpm setup      # Guided setup
pnpm dev        # Start development
pnpm build      # Build for production
pnpm docker:up  # Start Docker services
pnpm lint       # Run linter
pnpm test       # Run tests
```

---

## 📄 License

MIT License © 2026 junyuzhan - See [LICENSE](LICENSE) for details

---

## 👤 Author & Contributing

**junyuzhan** - [GitHub](https://github.com/junyuzhan) - junyuzhan@outlook.com

Contributions are welcome! See [CONTRIBUTING.md](docs/project/CONTRIBUTING.md)

---

## 🙏 Acknowledgments

Built with: [Next.js](https://nextjs.org/) • [PostgreSQL](https://www.postgresql.org/) • [MinIO](https://min.io/) • [Sharp](https://sharp.pixelplumbing.com/) • [Tailwind CSS](https://tailwindcss.com/) • [BullMQ](https://docs.bullmq.io/)
