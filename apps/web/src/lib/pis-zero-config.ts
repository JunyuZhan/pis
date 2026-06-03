/**
 * 自托管「零 compose 环境变量」时的应用侧默认值。
 * Postgres 官方镜像风格：库与用户名为 postgres、无密码（服务端 trust，见 docker/postgres/Dockerfile）。
 *
 * 安全说明：所有硬编码默认值仅用于本地开发和 Docker Compose 零配置场景。
 * 生产环境必须通过环境变量覆盖所有敏感值。
 */
export const PIS_DEFAULT_DATABASE_URL =
  "postgresql://postgres@postgres:5432/postgres";

/** 服务端代理 Worker 的内网地址（与 compose 服务名 worker 一致） */
export const PIS_DEFAULT_WORKER_INTERNAL_URL = "http://worker:3001";

/** 本机开发（非 Docker 内网）时的 Worker 默认地址 */
export const PIS_DEFAULT_WORKER_LOCALHOST_URL = "http://localhost:3001";

/** 空库时自动创建的默认管理员邮箱 */
export const PIS_DEFAULT_ADMIN_EMAIL = "admin@localhost";

/**
 * 生成仅用于零配置场景的临时 Worker API Key。
 * 每次进程启动时随机生成，生产环境务必通过 WORKER_API_KEY 环境变量覆盖。
 */
function generateFallbackWorkerApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let result = "pis-tmp-";
  for (let i = 0; i < 32; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * 生成仅用于零配置场景的临时管理员密码。
 * 每次进程启动时随机生成并打印到控制台。
 * 生产环境务必通过 PIS_ADMIN_PASSWORD 环境变量覆盖。
 */
function generateFallbackAdminPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

let _cachedWorkerApiKey: string | null = null;
let _cachedAdminPassword: string | null = null;

export function getDefaultWorkerApiKey(): string {
  if (!_cachedWorkerApiKey) {
    _cachedWorkerApiKey = generateFallbackWorkerApiKey();
    console.warn(
      "[PIS] WORKER_API_KEY unset; generated temporary key. Set WORKER_API_KEY env var for production.",
    );
  }
  return _cachedWorkerApiKey;
}

export function getDefaultAdminPassword(): string {
  if (!_cachedAdminPassword) {
    _cachedAdminPassword = generateFallbackAdminPassword();
    console.warn(
      "[PIS] Using generated admin password:",
      _cachedAdminPassword,
    );
    console.warn(
      "[PIS] Log in and change this password immediately. Set PIS_ADMIN_PASSWORD env var for production.",
    );
  }
  return _cachedAdminPassword;
}

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

/** 内建兜底 JWT 密钥（仅当未设置 AUTH_JWT_SECRET 且无法从数据库自愈时使用） */
export const PIS_BUILTIN_ZERO_JWT_SECRET =
  "pis-builtin-zero-config-jwt-signing-key-min-48-chars-change-in-prod!!";
