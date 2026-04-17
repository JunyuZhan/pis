import { NextRequest } from "next/server";
import { createClient } from "@/lib/database";
import { selectPhotoSchema, photoIdSchema } from "@/lib/validation/schemas";
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
 * 访客选片 API
 *
 * @route PATCH /api/public/photos/[id]/select
 * @description 允许匿名用户标记照片为「选中」状态，用于客户挑选喜欢的照片
 *
 * @auth 无需认证（公开接口）
 *
 * @param {string} id - 照片ID（UUID格式）
 *
 * @body {Object} requestBody - 选片请求体
 * @body {boolean} requestBody.isSelected - 是否选中（true/false，必填）
 * @body {string} [requestBody.albumPassword] - 相册密码（可选，与 HttpOnly Cookie 二选一）
 *
 * @returns {Object} 200 - 选片状态更新成功
 * @returns {boolean} 200.data.success - 操作是否成功
 * @returns {boolean} 200.data.isSelected - 更新后的选中状态
 *
 * @returns {Object} 400 - 请求参数错误（验证失败）
 * @returns {Object} 403 - 禁止访问（相册不允许选片或已过期）
 * @returns {Object} 404 - 照片不存在
 * @returns {Object} 500 - 服务器内部错误
 *
 * @note 此接口允许匿名访问；受保护相册需先调用 verify-password 取得 Cookie，或随请求传 albumPassword。
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params;

    const idValidation = safeValidate(photoIdSchema, paramsData);
    if (!idValidation.success) {
      return handleError(idValidation.error, "无效的照片ID");
    }

    const { id } = idValidation.data;
    const db = await createClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return ApiError.badRequest("请求体格式错误，请提供有效的JSON");
    }

    const validation = safeValidate(selectPhotoSchema, body);
    if (!validation.success) {
      return handleError(validation.error, "输入验证失败");
    }

    const { isSelected, albumPassword } = validation.data;

    const photoResult = await db
      .from<{ id: string; album_id: string; deleted_at: string | null }>(
        "photos",
      )
      .select("id, album_id, deleted_at")
      .eq("id", id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .single();

    if (photoResult.error || !photoResult.data) {
      return ApiError.notFound("照片不存在");
    }

    const photo = photoResult.data;

    const albumResult = await db
      .from<{
        id: string;
        slug: string;
        is_public: boolean;
        password: string | null;
        expires_at: string | null;
      }>("albums")
      .select("id, slug, is_public, password, expires_at")
      .eq("id", photo.album_id)
      .is("deleted_at", null)
      .single();

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound("相册不存在");
    }

    const album = albumResult.data;

    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden("相册已过期");
    }

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

    const updateResult = await db.update<{ id: string; is_selected: boolean }>(
      "photos",
      { is_selected: isSelected },
      { id },
    );

    if (updateResult.error) {
      return handleError(updateResult.error, "更新选中状态失败");
    }

    const updatedPhoto =
      updateResult.data && updateResult.data.length > 0
        ? updateResult.data[0]
        : null;
    if (!updatedPhoto) {
      return ApiError.notFound("照片不存在");
    }

    return createSuccessResponse({
      id: updatedPhoto.id,
      isSelected: updatedPhoto.is_selected,
    });
  } catch (error) {
    return handleError(error, "更新选中状态失败");
  }
}

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
      .from<{ id: string; is_selected: boolean; album_id: string }>("photos")
      .select("id, is_selected, album_id")
      .eq("id", id)
      .eq("status", "completed")
      .is("deleted_at", null)
      .single();

    if (photoResult.error || !photoResult.data) {
      return ApiError.notFound("照片不存在");
    }

    const photo = photoResult.data;

    const albumResult = await db
      .from<{
        id: string;
        slug: string;
        is_public: boolean;
        password: string | null;
        expires_at: string | null;
      }>("albums")
      .select("id, slug, is_public, password, expires_at")
      .eq("id", photo.album_id)
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

    return createSuccessResponse({
      id: photo.id,
      isSelected: photo.is_selected,
    });
  } catch (error) {
    return handleError(error, "查询选中状态失败");
  }
}
