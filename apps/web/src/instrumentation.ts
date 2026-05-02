/**
 * Node 服务端启动时补全环境变量；JWT 优先从数据库 pis_app_config 自愈（无 AUTH_JWT_SECRET 时）。
 * 不在此读写 node:fs，避免进入 Edge/middleware 打包图。
 */
import {
  PIS_BUILTIN_ZERO_JWT_SECRET,
  PIS_DEFAULT_DATABASE_URL,
  PIS_DEFAULT_WORKER_API_KEY,
  PIS_DEFAULT_WORKER_INTERNAL_URL,
} from "@/lib/pis-zero-config";

export async function register(): Promise<void> {
  if (!process.env.WORKER_API_KEY?.trim()) {
    process.env.WORKER_API_KEY = PIS_DEFAULT_WORKER_API_KEY;
    console.warn(
      "[PIS] WORKER_API_KEY unset; using zero-config default (set for production)",
    );
  }

  if (!process.env.WORKER_URL?.trim() && !process.env.WORKER_API_URL?.trim()) {
    const db = process.env.DATABASE_URL ?? "";
    if (db.includes("@postgres:")) {
      process.env.WORKER_URL = PIS_DEFAULT_WORKER_INTERNAL_URL;
    }
  }

  if (
    !process.env.DATABASE_URL?.trim() &&
    !process.env.DATABASE_PASSWORD?.trim() &&
    !process.env.POSTGRES_PASSWORD?.trim()
  ) {
    process.env.DATABASE_URL = PIS_DEFAULT_DATABASE_URL;
    console.warn(
      "[PIS] DATABASE_URL unset; using in-app Docker default (postgres@postgres/postgres)",
    );
  }

  if (!process.env.AUTH_JWT_SECRET?.trim()) {
    try {
      const { hydrateAuthJwtSecretFromDatabase } = await import(
        "@/lib/runtime-jwt-from-db"
      );
      await hydrateAuthJwtSecretFromDatabase();
    } catch (e) {
      console.warn(
        "[PIS] JWT DB hydrate failed; falling back to built-in zero secret:",
        e instanceof Error ? e.message : String(e),
      );
    }
    if (!process.env.AUTH_JWT_SECRET?.trim()) {
      process.env.AUTH_JWT_SECRET = PIS_BUILTIN_ZERO_JWT_SECRET;
      console.warn(
        "[PIS] AUTH_JWT_SECRET unset and DB unavailable; using built-in zero-config JWT secret (set AUTH_JWT_SECRET for production)",
      );
    }
  }

  if (!process.env.ALBUM_SESSION_SECRET?.trim() && process.env.AUTH_JWT_SECRET) {
    process.env.ALBUM_SESSION_SECRET = process.env.AUTH_JWT_SECRET;
  }

  const origin = (
    process.env.PIS_PUBLIC_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:8088"
  ).replace(/\/$/, "");

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    process.env.NEXT_PUBLIC_APP_URL = origin;
  }
  if (!process.env.NEXT_PUBLIC_MEDIA_URL) {
    process.env.NEXT_PUBLIC_MEDIA_URL = `${origin}/media`;
  }
  if (!process.env.NEXT_PUBLIC_WORKER_URL) {
    process.env.NEXT_PUBLIC_WORKER_URL = `${origin}/worker-api`;
  }
}
