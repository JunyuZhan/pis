import crypto from 'crypto'

const ALGORITHM = 'sha256'
const SALT_LENGTH = 16

export type AlbumPasswordCheckResult = {
  verified: boolean
  /** 明文遗留密码校验通过，需要升级为哈希存储 */
  needsRehash: boolean
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

/**
 * Hash an album access password for storage.
 * Format: algorithm:salt:hash
 * Uses SHA-256 with a random salt - appropriate for simple access control passwords
 * (distinct from user authentication which uses PBKDF2).
 */
export function hashAlbumPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
  const hash = crypto
    .createHmac(ALGORITHM, salt)
    .update(password)
    .digest('hex')
  return `${ALGORITHM}:${salt}:${hash}`
}

/**
 * Verify an album access password against a stored value.
 *
 * Supports both the hashed format (`algorithm:salt:hash`) and legacy plaintext
 * values created before hashing was introduced. For legacy plaintext values
 * that verify successfully, callers should persist the upgraded hash (see
 * {@link hashAlbumPassword}) to complete the migration.
 */
export function checkAlbumPassword(
  password: string,
  storedHash: string,
): AlbumPasswordCheckResult {
  if (!storedHash) return { verified: false, needsRehash: false }

  const legacyPlaintext = (): AlbumPasswordCheckResult => ({
    verified: safeEqual(password, storedHash),
    needsRehash: true,
  })

  if (!storedHash.includes(':')) {
    return legacyPlaintext()
  }

  const parts = storedHash.split(':')
  if (parts.length < 3) return legacyPlaintext()

  const [algorithm, salt, ...rest] = parts
  const hash = rest.join(':')
  // 仅识别本模块写入的 sha256 格式；其他格式按遗留明文处理（兼容含冒号的旧密码）
  if (algorithm !== ALGORITHM || !salt || !hash) {
    return legacyPlaintext()
  }

  try {
    const computed = crypto
      .createHmac(algorithm, salt)
      .update(password)
      .digest('hex')
    return { verified: safeEqual(computed, hash), needsRehash: false }
  } catch {
    return { verified: false, needsRehash: false }
  }
}

/**
 * Verify an album access password against a stored value (boolean form).
 */
export function verifyAlbumPassword(
  password: string,
  storedHash: string,
): boolean {
  return checkAlbumPassword(password, storedHash).verified
}
