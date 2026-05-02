/**
 * 访客相册 URL 与查询参数 `albumPassword`（与 RSC、公开 API 一致）。
 * 仅用于浏览器端；勿在日志中打印返回值。
 */
export function appendAlbumPasswordIfPresent(
  url: URL,
  albumPassword: string | null | undefined,
): void {
  if (albumPassword) {
    url.searchParams.set("albumPassword", albumPassword);
  }
}
