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

const MAX_FACE_UPLOAD_BYTES = 12 * 1024 * 1024; // 12MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const paramsData = await params;
  const slugValidation = safeValidate(albumSlugSchema, paramsData);
  if (!slugValidation.success) {
    return handleError(slugValidation.error, "无效的相册标识");
  }
  const { slug } = slugValidation.data;

  try {
    const ip = getTrustedClientIp(request);
    if (ip !== "unknown") {
      const rl = await checkRateLimit(`search-face:ip:${ip}`, 20, 60_000);
      if (!rl.allowed) {
        return NextResponse.json(
          {
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "人脸搜索请求过于频繁，请稍后再试",
            },
          },
          { status: 429 },
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return ApiError.badRequest("No file uploaded");
    }

    if (file.size > MAX_FACE_UPLOAD_BYTES) {
      return ApiError.badRequest("文件过大");
    }

    const db = await createClient();
    const { data: albumRow, error: albumError } = await db
      .from("albums")
      .select("id, slug, is_public, password, allow_share, expires_at")
      .eq("slug", slug)
      .is("deleted_at", null)
      .single();

    if (albumError || !albumRow) {
      return ApiError.notFound("Album not found");
    }

    const album = albumRow as {
      id: string;
      slug: string;
      is_public: boolean;
      password: string | null;
      allow_share: boolean;
      expires_at: string | null;
    };

    if (album.allow_share === false) {
      return ApiError.notFound("Album not found");
    }

    if (album.expires_at && new Date(album.expires_at) < new Date()) {
      return ApiError.forbidden("相册已过期");
    }

    const albumPassword =
      (formData.get("albumPassword") as string | null) || undefined;
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

    const albumId = album.id;

    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://ai:8000";

    const aiFormData = new FormData();
    aiFormData.append("file", file);

    let aiRes: Response;
    try {
      aiRes = await fetch(`${aiServiceUrl}/extract`, {
        method: "POST",
        body: aiFormData,
      });
    } catch (error) {
      console.warn("AI service unavailable, returning empty results:", error);
      return NextResponse.json({ photos: [] });
    }

    if (!aiRes.ok) {
      console.warn(`AI service error: ${aiRes.statusText}`);
      return NextResponse.json({ photos: [] });
    }

    const aiData = await aiRes.json();
    const faces = aiData.faces;

    if (!faces || faces.length === 0) {
      return NextResponse.json({ photos: [] });
    }

    const embedding = faces[0].embedding;
    const vectorStr = `[${embedding.join(",")}]`;

    const { data: matchesData, error } = await db.rpc("search_faces", {
      query_embedding: vectorStr,
      match_threshold: 0.6,
      match_count: 50,
      filter_album_id: albumId,
    });

    if (error) throw error;

    const matches = matchesData as
      | Array<{ photo_id: string; similarity: number }>
      | null;

    if (!matches || matches.length === 0) {
      return NextResponse.json({ photos: [] });
    }

    const photoIds = matches.map((m) => m.photo_id);

    const { data: photos } = await db
      .from("photos")
      .select("*")
      .in("id", photoIds)
      .eq("status", "completed");

    return NextResponse.json({ photos: photos || [] });
  } catch (err: unknown) {
    return handleError(err as Error, "Search failed");
  }
}
