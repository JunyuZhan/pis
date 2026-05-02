/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

const { mockFrom, mockGetCurrentUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/api-helpers", () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

vi.mock("@/lib/database", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: mockFrom,
  }),
}));

function mockAlbumChain(singleResult: {
  data: unknown;
  error: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(singleResult);
  const mockIs = vi.fn().mockReturnValue({ maybeSingle });
  const mockEq = vi.fn().mockReturnValue({ is: mockIs });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect });
}

describe("GET /api/realtime/photos/[albumId]", () => {
  const albumId = "550e8400-e29b-41d4-a716-446655440001";
  const slug = "wedding-day";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("WORKER_API_KEY", "test-worker-key");
    vi.stubEnv("WORKER_URL", "http://localhost:3001");
    mockGetCurrentUser.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 403 when anonymous without slug", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/realtime/photos/${albumId}`,
    );
    const res = await GET(req, { params: Promise.resolve({ albumId }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 when albumId does not match slug row", async () => {
    mockAlbumChain({
      data: {
        id: "other-id",
        slug,
        is_public: true,
        password: null,
        expires_at: null,
      },
      error: null,
    });
    const req = new NextRequest(
      `http://localhost:3000/api/realtime/photos/${albumId}?slug=${slug}`,
    );
    const res = await GET(req, { params: Promise.resolve({ albumId }) });
    expect(res.status).toBe(403);
  });

  it("returns 403 for password album when guest has no cookie or albumPassword", async () => {
    mockAlbumChain({
      data: {
        id: albumId,
        slug,
        is_public: true,
        password: "secret",
        expires_at: null,
      },
      error: null,
    });
    const req = new NextRequest(
      `http://localhost:3000/api/realtime/photos/${albumId}?slug=${slug}`,
    );
    const res = await GET(req, { params: Promise.resolve({ albumId }) });
    expect(res.status).toBe(403);
  });

  it("proxies SSE when public album has no password", async () => {
    mockAlbumChain({
      data: {
        id: albumId,
        slug,
        is_public: true,
        password: null,
        expires_at: null,
      },
      error: null,
    });

    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("event: ping\ndata: {}\n\n"));
        controller.close();
      },
    });

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      body,
    } as Response);

    const req = new NextRequest(
      `http://localhost:3000/api/realtime/photos/${albumId}?slug=${slug}`,
    );
    const res = await GET(req, { params: Promise.resolve({ albumId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://localhost:3001/api/sse/photos/${albumId}`,
      expect.objectContaining({
        headers: { "X-API-Key": "test-worker-key" },
      }),
    );
    fetchSpy.mockRestore();
  });

  it("allows password album when albumPassword query matches", async () => {
    mockAlbumChain({
      data: {
        id: albumId,
        slug,
        is_public: true,
        password: "secret",
        expires_at: null,
      },
      error: null,
    });

    const body = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      body,
    } as Response);

    const req = new NextRequest(
      `http://localhost:3000/api/realtime/photos/${albumId}?slug=${slug}&albumPassword=${encodeURIComponent("secret")}`,
    );
    const res = await GET(req, { params: Promise.resolve({ albumId }) });
    expect(res.status).toBe(200);
    fetchSpy.mockRestore();
  });
});
