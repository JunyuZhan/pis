/**
 * Docker 零凭据栈：users 表为空时插入可登录的默认管理员（与 apps/web 约定一致）。
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import pg from 'pg';

const DEFAULT_ADMIN_EMAIL = 'admin@localhost';
const DEFAULT_ADMIN_PASSWORD = '123456';
const ZERO_DATABASE_URL = 'postgresql://postgres@postgres:5432/postgres';

const MAX_ATTEMPTS = 8;
const RETRY_MS = 1500;

function hashPasswordSync(password: string): string {
  const salt = randomBytes(32).toString('hex');
  const iterations = 100000;
  const keylen = 64;
  const derivedKey = pbkdf2Sync(
    password,
    salt,
    iterations,
    keylen,
    'sha512',
  );
  return `${salt}:${iterations}:${derivedKey.toString('hex')}`;
}

function resolveDatabaseUrl(): string | null {
  if ((process.env.DATABASE_TYPE || 'postgresql').toLowerCase() === 'supabase') {
    return null;
  }
  const u = process.env.DATABASE_URL?.trim();
  if (u) return u;
  if (
    !process.env.DATABASE_PASSWORD?.trim() &&
    !process.env.POSTGRES_PASSWORD?.trim()
  ) {
    return ZERO_DATABASE_URL;
  }
  return null;
}

export async function ensureDefaultAdminUser(): Promise<void> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return;
  }
  const databaseUrl = resolveDatabaseUrl();
  if (
    !databaseUrl ||
    (!databaseUrl.startsWith('postgresql://') &&
      !databaseUrl.startsWith('postgres://'))
  ) {
    return;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: 8000,
    });
    try {
      const { rows: cntRows } = await pool.query<{ c: string }>(
        'SELECT COUNT(*)::text AS c FROM users',
      );
      const n = parseInt(cntRows[0]?.c ?? '0', 10);
      if (n > 0) {
        return;
      }

      const passwordHash = hashPasswordSync(DEFAULT_ADMIN_PASSWORD);
      await pool.query(
        `INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
         VALUES ($1, $2, 'admin', true, NOW(), NOW())`,
        [DEFAULT_ADMIN_EMAIL, passwordHash],
      );

      console.warn(
        `[PIS Worker] 空库已创建默认管理员：${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}。请在 Web 后台立即修改密码。`,
      );
      return;
    } catch (e: unknown) {
      if (
        typeof e === 'object' &&
        e !== null &&
        'code' in e &&
        (e as { code: string }).code === '23505'
      ) {
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      const retryable =
        /does not exist|connection refused|ECONNREFUSED|timeout/i.test(msg) &&
        attempt < MAX_ATTEMPTS;
      if (retryable) {
        await new Promise((r) => setTimeout(r, RETRY_MS));
        continue;
      }
      console.warn(
        '[PIS Worker] 默认管理员引导跳过（数据库未就绪或非空库）:',
        msg,
      );
      return;
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
}
