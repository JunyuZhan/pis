import { NextRequest } from "next/server";
import { createClient } from "@/lib/database";
import { albumSlugSchema } from "@/lib/validation/schemas";
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
  params: Promise<{ slug: string }>;
}

/**
 * 批量下载已选照片 API
 *
 * @route GET /api/public/albums/[slug]/download-selected
 * @description 获取所有已选照片的下载链接列表，用于批量下载
 *
 * @auth 无需认证（公开接口，但需要相册允许批量下载）
 *
 * @param {string} slug - 相册标识（URL友好格式）
 * @query {string} [albumPassword] - 相册密码（可选，与 HttpOnly Cookie 二选一）
 *
 * @returns {Object} 200 - 成功返回下载链接列表
 *
 * @returns {Object} 403 - 禁止访问（相册不允许下载、不允许批量下载或无权访问）
 * @returns {Object} 404 - 相册不存在
 * @returns {Object} 500 - 服务器内部错误
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params;

    const slugValidation = safeValidate(albumSlugSchema, paramsData);
    if (!slugValidation.success) {
      return handleError(slugValidation.error, "无效的相册标识");
    }

    const { slug } = slugValidation.data;
    const db = await createClient();

    const albumResult = await db
      .from<{
        id: string;
        slug: string;
        title: string | null;
        is_public: boolean;
        password: string | null;
        allow_download: boolean;
        allow_batch_download: boolean;
        expires_at: string | null;
      }>("albums")
      .select(
        "id, slug, title, is_public, password, allow_download, allow_batch_download, expires_at",
      )
      .eq("slug", slug)
      .is("deleted_at", null)
      .single();

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound("相册不存在");
    }

    const album = albumResult.data;

    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden("相册已过期");
    }

    const albumPassword =
      req.nextUrl.searchParams.get("albumPassword") ?? undefined;
    const access = await assertGuestAlbumAccess(
      req,
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

    if (!album.allow_download) {
      return ApiError.forbidden("此相册不允许下载");
    }

    if (!album.allow_batch_download) {
      return ApiError.forbidden("此相册不允许批量下载");
    }

    const photosResult = await db
      .from<{
        id: string;
        filename: string | null;
        original_key: string | null;
      }>("photos")
      .select("id, filename, original_key")
      .eq("album_id", album.id)
      .eq("is_selected", true)
      .eq("status", "completed")
      .order("sort_order", { ascending: true });

    if (photosResult.error) {
      throw photosResult.error;
    }

    const photos = photosResult.data || [];

    if (!photos || photos.length === 0) {
      return ApiError.badRequest("没有已选照片");
    }

    const workerUrl =
      process.env.WORKER_URL ||
      process.env.WORKER_API_URL ||
      "http://localhost:3001";
    const workerApiKey = process.env.WORKER_API_KEY;

    if (!workerApiKey) {
      return handleError(new Error("WORKER_API_KEY not configured"), "服务器配置错误");
    }

    const downloadLinks = await Promise.all(
      photos.map(async (photo) => {
        try {
          const workerResponse = await fetch(`${workerUrl}/api/presign/get`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": workerApiKey,
            },
            body: JSON.stringify({
              key: photo.original_key,
              expirySeconds: 5 * 60,
              responseContentDisposition: `attachment; filename="${encodeURIComponent(photo.filename || "photo")}"`,
            }),
          });

          if (!workerResponse.ok) {
            console.error(
              `[Batch Download API] Failed to generate presigned URL for photo ${photo.id}`,
            );
            throw new Error("Failed to generate download URL");
          }

          const { url: downloadUrl } = await workerResponse.json();

          return {
            id: photo.id,
            filename: photo.filename,
            url: downloadUrl,
          };
        } catch (error) {
          console.error(
            `[Batch Download API] Error generating URL for photo ${photo.id}:`,
            error,
          );
          return null;
        }
      }),
    );

    const validLinks = downloadLinks.filter(
      (link): link is NonNullable<typeof link> => link !== null,
    );

    if (validLinks.length === 0) {
      return handleError(new Error("无法生成下载链接"), "无法生成下载链接");
    }

    return createSuccessResponse({
      albumTitle: album.title,
      count: validLinks.length,
      photos: validLinks,
    });
  } catch (error) {
    return handleError(error, "获取下载链接失败");
  }
}
