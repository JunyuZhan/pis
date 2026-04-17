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

/**
 * 判断访客是否可对相册执行选片 / 批量下载等操作。
 * - 完全公开且无密码：允许。
 * - 否则：需 Cookie 中的相册 JWT（验密成功后签发），或本次请求提供正确相册密码。
 */
export async function assertGuestAlbumAccess(
  request: NextRequest,
  album: AlbumGateFields,
  albumPasswordFromBody?: string | null,
): Promise<{ ok: true } | { ok: false; reason: "forbidden" | "password_required" }> {
  if (album.is_public && !album.password) {
    return { ok: true };
  }

  if (
    albumPasswordFromBody &&
    album.password &&
    albumPasswordFromBody === album.password
  ) {
    return { ok: true };
  }

  const raw = request.cookies.get(ALBUM_ACCESS_COOKIE_NAME)?.value;
  const claims = await verifyAlbumAccessJwt(raw);
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
