/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import {
  createAlbumAccessJwt,
  verifyAlbumAccessJwt,
} from "@/lib/auth/album-access-jwt";

describe("album-access-jwt", () => {
  it("round-trips album id and slug", async () => {
    const token = await createAlbumAccessJwt("album-uuid", "my-slug");
    const claims = await verifyAlbumAccessJwt(token);
    expect(claims).toEqual({ albumId: "album-uuid", slug: "my-slug" });
  });

  it("returns null for invalid token", async () => {
    expect(await verifyAlbumAccessJwt(undefined)).toBeNull();
    expect(await verifyAlbumAccessJwt("not-a-jwt")).toBeNull();
  });
});
