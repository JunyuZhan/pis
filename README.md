# 📸 PIS — Private Instant Photo Sharing

[![GitHub stars](https://img.shields.io/github/stars/JunyuZhan/pis?style=social)](https://github.com/JunyuZhan/pis)

Self-hosted photo delivery for photographers and studios: **FTP ingest from cameras**, image processing (thumbnails, watermarks, presets), **albums with access control**, and an admin console. Stack: **Next.js**, **PostgreSQL**, **MinIO**, **Redis**, **Worker (BullMQ + Sharp)**, **Nginx** — all runnable with **Docker Compose**.

[中文](README.zh-CN.md) · [English](README.md)

## Features (high level)

- Camera **FTP** upload · batch and multipart upload in the web UI  
- **Roles** (admin, photographer, retoucher, viewer) and album passwords / expiry  
- **Watermarks**, style presets, EXIF handling (e.g. GPS strip for privacy)  
- **Self-hosted** data: PostgreSQL + MinIO + Redis; optional Docker Secrets layout for production  

## Quick start

**Interactive (clone this repo)**

```bash
git clone https://github.com/JunyuZhan/pis.git
cd pis/docker
bash deploy.sh
```

**One-liner installer** (installs Docker if needed, generates secrets, starts the stack)

```bash
curl -sSL https://raw.githubusercontent.com/JunyuZhan/pis/main/scripts/deploy/one-click-deploy.sh | bash
```

**Deploy from pre-built `web` / `worker` images** (private registry or Docker Hub + `docker/` bundle, no app build on the server): see **[docker/README.md](docker/README.md)** and **[docker/DOCKER_COMPOSE_FILES.md](docker/DOCKER_COMPOSE_FILES.md)** — e.g. `cd docker && bash start-from-registry.sh` after `.env` is set.

Default Docker layout often exposes the app on **port 8088** (Nginx). Details: **[Deployment guide](docs/i18n/en/DEPLOYMENT.md)**.

## Documentation

| Topic | Link |
|--------|------|
| Deployment | [docs/i18n/en/DEPLOYMENT.md](docs/i18n/en/DEPLOYMENT.md) |
| Docker / Compose / registry images | [docker/README.md](docker/README.md) |
| Development | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| User guide | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| Architecture / internals | [docs/HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Full index | [docs/README.md](docs/README.md) |

## Contributing

Issues and pull requests are welcome. See **[CONTRIBUTING.md](docs/project/CONTRIBUTING.md)**.

## License

**MIT** — see [LICENSE](LICENSE). Copyright © 2026 junyuzhan.

## Contact

- GitHub: [@JunyuZhan/pis](https://github.com/JunyuZhan/pis) · [@junyuzhan](https://github.com/junyuzhan)  
- Email: junyuzhan@outlook.com  
