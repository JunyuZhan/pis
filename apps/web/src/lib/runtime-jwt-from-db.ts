/**
 * 首次启动时从 PostgreSQL 读取或生成 AUTH_JWT_SECRET，写入 pis_app_config（与 Edge 无关，仅 Node instrumentation 调用）。
 */
const JWT_KEY = "auth_jwt_secret";

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

export async function hydrateAuthJwtSecretFromDatabase(): Promise<void> {
  if (process.env.AUTH_JWT_SECRET?.trim()) {
    return;
  }
  if (process.env.NODE_ENV === "test" || process.env.VITEST) {
    return;
  }
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (
    !dbUrl ||
    (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://"))
  ) {
    return;
  }

  const pgMod = await import(/* webpackIgnore: true */ "pg");
  const pg = pgMod.default;
  const pool = new pg.Pool({
    connectionString: dbUrl,
    max: 1,
    connectionTimeoutMillis: 12000,
  });

  try {
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS pis_app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        const candidate = randomHex(48);
        await pool.query(
          `INSERT INTO pis_app_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
          [JWT_KEY, candidate],
        );
        const { rows } = await pool.query<{ value: string }>(
          `SELECT value FROM pis_app_config WHERE key = $1 LIMIT 1`,
          [JWT_KEY],
        );
        const v = rows[0]?.value?.trim();
        if (v) {
          process.env.AUTH_JWT_SECRET = v;
          return;
        }
      } catch (e) {
        if (attempt === 10) {
          throw e;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}
