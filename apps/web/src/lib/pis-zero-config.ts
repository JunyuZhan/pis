/**
 * 自托管「零 compose 环境变量」时的应用侧默认值。
 * Postgres 官方镜像风格：库与用户名为 postgres、无密码（服务端 trust，见 docker/postgres/Dockerfile）。
 */
export const PIS_DEFAULT_DATABASE_URL =
  "postgresql://postgres@postgres:5432/postgres";

export const PIS_DEFAULT_WORKER_API_KEY = "pis-docker-default-worker-api-key";

/** 服务端代理 Worker 的内网地址（与 compose 服务名 worker 一致） */
export const PIS_DEFAULT_WORKER_INTERNAL_URL = "http://worker:3001";

/** 本机开发（非 Docker 内网）时的 Worker 默认地址 */
export const PIS_DEFAULT_WORKER_LOCALHOST_URL = "http://localhost:3001";

/** 空库时自动创建的默认管理员（登录后请立即修改密码） */
export const PIS_DEFAULT_ADMIN_EMAIL = "admin@localhost";

export const PIS_DEFAULT_ADMIN_PASSWORD = "123456";

/**
 * 未设置 WORKER_URL 时：Docker 内网（DATABASE_URL 指向服务名 postgres）用 worker；否则用 localhost。
 */
export function resolveDefaultWorkerInternalUrl(): string {
  const db = process.env.DATABASE_URL ?? "";
  if (db.includes("@postgres:")) {
    return PIS_DEFAULT_WORKER_INTERNAL_URL;
  }
  return PIS_DEFAULT_WORKER_LOCALHOST_URL;
}

/** 内建兜底 JWT 密钥（仅当未设置 AUTH_JWT_SECRET 且无法读写持久化文件时使用） */
export const PIS_BUILTIN_ZERO_JWT_SECRET =
  "pis-builtin-zero-config-jwt-signing-key-min-48-chars-change-in-prod!!";
