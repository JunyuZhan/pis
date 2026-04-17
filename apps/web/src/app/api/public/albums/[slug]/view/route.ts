import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/database";
import { albumSlugSchema } from "@/lib/validation/schemas";
import {
  safeValidate,
  handleError,
  ApiError,
  createErrorResponse,
  ErrorCode,
} from "@/lib/validation/error-handler";
import { checkRateLimit } from "@/middleware-rate-limit";
import { getTrustedClientIp } from "@/lib/request-client-ip";
import { assertGuestAlbumAccess } from "@/lib/public-album-guest-access";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * 增加相册浏览次数
 * POST /api/public/albums/[slug]/view
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params;

    const slugValidation = safeValidate(albumSlugSchema, paramsData);
    if (!slugValidation.success) {
      return handleError(slugValidation.error, "无效的相册slug");
    }

    const { slug } = slugValidation.data;

    const ip = getTrustedClientIp(request);
    if (ip !== "unknown") {
      const rl = await checkRateLimit(`album-view:ip:${ip}:${slug}`, 120, 60_000);
      if (!rl.allowed) {
        return NextResponse.json(
          {
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "浏览上报过于频繁，请稍后再试",
            },
          },
          { status: 429 },
        );
      }
    }

    const db = await createClient();

    const albumResult = await db
      .from<{
        id: string;
        slug: string;
        is_public: boolean;
        password: string | null;
        allow_share: boolean;
        expires_at: string | null;
      }>("albums")
      .select("id, slug, is_public, password, allow_share, expires_at")
      .eq("slug", slug)
      .is("deleted_at", null)
      .single();

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound("相册不存在");
    }

    const album = albumResult.data;

    if (album.allow_share === false) {
      return ApiError.notFound("相册不存在");
    }

    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden("相册已过期");
    }

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const albumPassword =
      typeof body === "object" &&
      body !== null &&
      "albumPassword" in body &&
      typeof (body as { albumPassword?: unknown }).albumPassword === "string"
        ? (body as { albumPassword: string }).albumPassword
        : undefined;

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

    const rpcResult = await db.rpc("increment_album_view_count", {
      album_id: album.id,
    });

    let newViewCount: number;

    if (rpcResult.error) {
      const currentAlbumResult = await db
        .from<{ view_count: number | null }>("albums")
        .select("view_count")
        .eq("id", album.id)
        .single();

      if (currentAlbumResult.data) {
        newViewCount = (currentAlbumResult.data.view_count || 0) + 1;
        await db.update("albums", { view_count: newViewCount }, { id: album.id });
      } else {
        newViewCount = 1;
      }
    } else {
      const updatedAlbumResult = await db
        .from<{ view_count: number | null }>("albums")
        .select("view_count")
        .eq("id", album.id)
        .single();

      newViewCount = updatedAlbumResult.data?.view_count || 1;
    }

    return NextResponse.json({ success: true, view_count: newViewCount });
  } catch (error) {
    try {
      const paramsData = await params;
      const slugValidation = safeValidate(albumSlugSchema, paramsData);
      if (slugValidation.success) {
        const db = await createClient();
        const albumResult = await db
          .from<{ view_count: number | null }>("albums")
          .select("view_count")
          .eq("slug", slugValidation.data.slug)
          .is("deleted_at", null)
          .single();

        return NextResponse.json({
          success: false,
          view_count: albumResult.data?.view_count || 0,
          error: "Failed to increment view count",
        });
      }
    } catch {
      // ignore
    }
    return handleError(error, "增加浏览次数失败");
  }
}
