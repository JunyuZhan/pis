import crypto from 'crypto'

const ALGORITHM = 'sha256'
const SALT_LENGTH = 16

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
 * Verify an album access password against a stored hash.
 * Returns false for plaintext legacy passwords (which should be re-hashed).
 */
export function verifyAlbumPassword(
  password: string,
  storedHash: string,
): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false
  }

  const parts = storedHash.split(':')
  if (parts.length !== 3) return false

  const [algorithm, salt, hash] = parts
  if (!algorithm || !salt || !hash) return false

  try {
    const computed = crypto
      .createHmac(algorithm, salt)
      .update(password)
      .digest('hex')
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash))
  } catch {
    return false
  }
}
