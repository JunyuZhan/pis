import type { NextRequest } from 'next/server'

/**
 * 解析客户端 IP，用于限流与审计。
 *
 * 默认**不信任** `X-Forwarded-For` / `X-Real-IP`（易被客户端伪造）。
 * 在反向代理（Cloudflare、ALB 等）后部署时，请设置环境变量：
 * `PIS_TRUST_PROXY_HEADERS=true`（或 `TRUST_PROXY_HEADERS=true`）后再使用链路上的受信头。
 *
 * `CF-Connecting-IP` 仅在启用信任模式时读取（通常由 Cloudflare 注入）。
 */
export function getTrustedClientIp(request: NextRequest): string {
  const trust =
    process.env.PIS_TRUST_PROXY_HEADERS === 'true' ||
    process.env.TRUST_PROXY_HEADERS === 'true'

  if (trust) {
    const cf = request.headers.get('cf-connecting-ip')?.trim()
    if (cf) return cf
    const xff = request.headers.get('x-forwarded-for')
    if (xff) {
      const first = xff.split(',')[0]?.trim()
      if (first) return first
    }
    const xr = request.headers.get('x-real-ip')?.trim()
    if (xr) return xr
  }

  return 'unknown'
}
