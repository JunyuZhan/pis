/**
 * 访客相册访问 JWT（HttpOnly Cookie），用于密码相册 / 非公开相册的选片与批量下载等 API。
 * 与登录 JWT 共用 AUTH_JWT_SECRET，受众隔离为 pis-album-access。
 */
import { SignJWT, jwtVerify } from "jose";
import { PIS_BUILTIN_ZERO_JWT_SECRET } from "@/lib/pis-zero-config";

function getAlbumAccessSecret(): Uint8Array {
  const raw = (
    process.env.AUTH_JWT_SECRET ||
    process.env.ALBUM_SESSION_SECRET ||
    PIS_BUILTIN_ZERO_JWT_SECRET
  ).trim();
  return new TextEncoder().encode(raw);
}

const JWT_SECRET = getAlbumAccessSecret();

const JWT_ISSUER = "pis-auth";
const ALBUM_ACCESS_AUDIENCE = "pis-album-access";

/** HttpOnly Cookie 名称（与 slug 无关，载荷内带 slug + albumId） */
export const ALBUM_ACCESS_COOKIE_NAME = "pis-album-access";

export async function createAlbumAccessJwt(
  albumId: string,
  slug: string,
): Promise<string> {
  return await new SignJWT({ scope: "album_access", slug })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(albumId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .setIssuer(JWT_ISSUER)
    .setAudience(ALBUM_ACCESS_AUDIENCE)
    .sign(JWT_SECRET);
}

export async function verifyAlbumAccessJwt(
  token: string | undefined,
): Promise<{ albumId: string; slug: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: ALBUM_ACCESS_AUDIENCE,
    });
    if (payload.scope !== "album_access" || typeof payload.slug !== "string") {
      return null;
    }
    const albumId = payload.sub;
    if (!albumId || typeof albumId !== "string") return null;
    return { albumId, slug: payload.slug };
  } catch {
    return null;
  }
}
