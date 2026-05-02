import type { NextRequest } from "next/server";
import {
  ALBUM_ACCESS_COOKIE_NAME,
  verifyAlbumAccessJwt,
} from "@/lib/auth/album-access-jwt";

export type AlbumGateFields = {
  id: string;
  slug: string;
  is_public: boolean;
  password: string | null;
};

export type GuestAlbumAccessResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "password_required" };

/**
 * 与 {@link assertGuestAlbumAccess} 相同规则，供 RSC / `generateMetadata` 等无 `NextRequest` 场景使用。
 */
export async function evaluateGuestAlbumAccess(
  album: AlbumGateFields,
  opts: {
    rawAlbumAccessCookie?: string | undefined;
    albumPassword?: string | null;
  },
): Promise<GuestAlbumAccessResult> {
  if (album.is_public && !album.password) {
    return { ok: true };
  }

  const albumPassword = opts.albumPassword ?? null;
  if (
    albumPassword &&
    album.password &&
    albumPassword === album.password
  ) {
    return { ok: true };
  }

  const claims = await verifyAlbumAccessJwt(opts.rawAlbumAccessCookie);
  if (
    claims &&
    claims.albumId === album.id &&
    claims.slug === album.slug
  ) {
    return { ok: true };
  }

  if (album.password) {
    return { ok: false, reason: "password_required" };
  }
  return { ok: false, reason: "forbidden" };
}

/**
 * 判断访客是否可对相册执行选片 / 批量下载等操作。
 * - 完全公开且无密码：允许。
 * - 否则：需 Cookie 中的相册 JWT（验密成功后签发），或本次请求提供正确相册密码。
 */
export async function assertGuestAlbumAccess(
  request: NextRequest,
  album: AlbumGateFields,
  albumPasswordFromBody?: string | null,
): Promise<GuestAlbumAccessResult> {
  const raw = request.cookies.get(ALBUM_ACCESS_COOKIE_NAME)?.value;
  return evaluateGuestAlbumAccess(album, {
    rawAlbumAccessCookie: raw,
    albumPassword: albumPasswordFromBody ?? null,
  });
}
