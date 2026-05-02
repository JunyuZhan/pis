import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/api-helpers";
import { createClient } from "@/lib/database";
import { assertGuestAlbumAccess } from "@/lib/public-album-guest-access";

function getWorkerBaseUrl(): string {
  return (
    process.env.WORKER_URL ||
    process.env.WORKER_API_URL ||
    "http://localhost:3001"
  );
}

/**
 * 将浏览器 SSE 代理到 Worker，由服务端附加 `WORKER_API_KEY`。
 * - 已登录：允许订阅任意相册（与后台修图/管理场景一致）。
 * - 未登录：必须提供 `?slug=`，且 `albumId` 与 slug 对应相册一致；访问规则与选片 / 验密一致
 *   （`assertGuestAlbumAccess`：公开无密 / Cookie `pis-album-access` / `?albumPassword=`）。
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> },
) {
  const { albumId } = await params;
  if (!albumId) {
    return new Response("Bad Request", { status: 400 });
  }

  const user = await getCurrentUser(request);
  if (!user) {
    const slug = request.nextUrl.searchParams.get("slug");
    if (!slug) {
      return new Response("Forbidden", { status: 403 });
    }
    const albumPassword =
      request.nextUrl.searchParams.get("albumPassword") ?? undefined;

    const db = await createClient();
    const { data, error } = await db
      .from("albums")
      .select("id, slug, is_public, password, expires_at")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    const row = data as {
      id: string;
      slug: string;
      is_public: boolean;
      password: string | null;
      expires_at: string | null;
    } | null;

    if (error || !row || row.id !== albumId) {
      return new Response("Forbidden", { status: 403 });
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return new Response("Forbidden", { status: 403 });
    }

    const access = await assertGuestAlbumAccess(
      request,
      {
        id: row.id,
        slug: row.slug,
        is_public: row.is_public,
        password: row.password,
      },
      albumPassword ?? null,
    );
    if (!access.ok) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  const workerApiKey = process.env.WORKER_API_KEY;
  if (!workerApiKey) {
    return new Response("Service Unavailable", { status: 503 });
  }

  const upstreamUrl = `${getWorkerBaseUrl()}/api/sse/photos/${encodeURIComponent(albumId)}`;
  const upstream = await fetch(upstreamUrl, {
    headers: { "X-API-Key": workerApiKey },
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.statusText || "Upstream error", {
      status: upstream.status || 502,
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
