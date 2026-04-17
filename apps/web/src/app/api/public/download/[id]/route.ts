import { NextRequest } from "next/server";
import { createClient } from "@/lib/database";
import { photoIdSchema } from "@/lib/validation/schemas";
import {
  safeValidate,
  handleError,
  createSuccessResponse,
  createErrorResponse,
  ApiError,
  ErrorCode,
} from "@/lib/validation/error-handler";
import { assertGuestAlbumAccess } from "@/lib/public-album-guest-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 原图下载 API
 *
 * @route GET /api/public/download/[id]
 * @description 生成公开媒体路径；仅当相册允许下载且访客有权访问相册时返回
 *
 * @query {string} [albumPassword] - 相册密码（可选，与 HttpOnly Cookie 二选一）
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params;

    const idValidation = safeValidate(photoIdSchema, paramsData);
    if (!idValidation.success) {
      return handleError(idValidation.error, "无效的照片ID");
    }

    const { id } = idValidation.data;
    const db = await createClient();

    const photoResult = await db
      .from<{
        id: string;
        original_key: string | null;
        filename: string | null;
        album_id: string;
        status: string;
      }>("photos")
      .select("id, original_key, filename, album_id, status")
      .eq("id", id)
      .in("status", ["completed", "failed"])
      .single();

    if (photoResult.error || !photoResult.data) {
      return ApiError.notFound("照片不存在");
    }

    const photo = photoResult.data;

    if (photo.status === "failed" && !photo.original_key) {
      return ApiError.notFound("照片文件不存在");
    }

    const albumResult = await db
      .from<{
        id: string;
        slug: string;
        is_public: boolean;
        password: string | null;
        allow_download: boolean;
        deleted_at: string | null;
        expires_at: string | null;
      }>("albums")
      .select(
        "id, slug, is_public, password, allow_download, deleted_at, expires_at",
      )
      .eq("id", photo.album_id)
      .single();

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound("相册不存在");
    }

    const album = albumResult.data;

    if (album.deleted_at) {
      return ApiError.notFound("相册不存在");
    }

    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden("相册已过期");
    }

    if (!album.allow_download) {
      return ApiError.forbidden("该相册不允许下载原图");
    }

    const albumPassword =
      request.nextUrl.searchParams.get("albumPassword") ?? undefined;
    const access = await assertGuestAlbumAccess(
      request,
      {
        id: album.id,
        slug: album.slug,
        is_public: album.is_public,
        password: album.password,
      },
      albumPassword ?? null,
    );
    if (!access.ok) {
      if (access.reason === "password_required") {
        return createErrorResponse(
          ErrorCode.ALBUM_PASSWORD_REQUIRED,
          "需要相册密码或先通过密码验证",
          undefined,
          403,
        );
      }
      return ApiError.forbidden("禁止访问此相册");
    }

    const originalKey = photo.original_key || "";
    const downloadUrl = `/media/${originalKey}`;

    return createSuccessResponse({
      downloadUrl,
      filename: photo.filename || "photo",
    });
  } catch (error: unknown) {
    return handleError(error, "获取下载链接失败");
  }
}
