# Docker 部署说明

目录需包含：`docker-compose.yml`、`nginx/`、`init-postgresql-db.sql`。

- **Postgres**：`compose` 中 **仅** `POSTGRES_HOST_AUTH_METHOD=trust`（满足官方镜像空卷启动；非业务变量）。
- **MinIO**：`command: server /data --console-address :9001`（官方 CLI；凭据默认 `minioadmin`，与代码一致）。
- **业务**：JWT / 桶 / 管理员等由应用启动逻辑处理（见 `apps/web`、`services/worker`）。

```bash
cd docker
docker compose pull
docker compose up -d
```

## 相关文档

- [docker/README.md](./README.md)
