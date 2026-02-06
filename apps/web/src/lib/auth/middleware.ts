/**
 * PIS Web - 自定义认证中间件
 *
 * 用于完全自托管模式，不依赖 Supabase
 *
 * @author junyuzhan
 * @license MIT
 *
 * @description
 * 提供 Next.js 中间件功能：
 * - 自动刷新即将过期的令牌
 * - 管理后台页面认证保护
 * - 登录页面重定向逻辑
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { updateSession } from '@/lib/auth/middleware'
 *
 * export async function middleware(request: NextRequest) {
 *   return updateSession(request)
 * }
 * ```
 */
import { NextResponse, type NextRequest } from "next/server";
import { getUserFromRequest, updateSessionMiddleware } from "./jwt-helpers";

/**
 * 更新会话中间件
 *
 * @description
 * 执行以下操作：
 * 1. 刷新即将过期的令牌
 * 2. 检查用户认证状态
 * 3. 处理管理后台页面认证
 * 4. 处理登录页面重定向
 *
 * 路由规则：
 * - `/admin/login` - 未登录可访问，已登录重定向到 `/admin`
 * - `/admin/*` - 需要登录，未登录重定向到 `/admin/login`
 *
 * @param request - Next.js 请求对象
 * @returns Next.js 响应对象
 *
 * @example
 * ```typescript
 * // 在项目根目录的 middleware.ts 中
 * import { updateSession } from '@/lib/auth/middleware'
 *
 * export { updateSession as middleware } from '@/lib/auth/middleware'
 *
 * // 或使用自定义配置
 * import { updateSession } from '@/lib/auth/middleware'
 * import { NextResponse } from 'next/server'
 *
 * export async function middleware(request: NextRequest) {
 *   const response = await updateSession(request)
 *   // 添加自定义逻辑...
 *   return response
 * }
 * ```
 */
export async function updateSession(request: NextRequest) {
  // 开发环境：输出环境变量状态（用于调试）
  if (
    process.env.NODE_ENV === "development" &&
    request.nextUrl.pathname.startsWith("/admin")
  ) {
    console.log("[Middleware] Environment check:", {
      pathname: request.nextUrl.pathname,
      hasAuthJwtSecret: !!process.env.AUTH_JWT_SECRET,
      authJwtSecretLength: process.env.AUTH_JWT_SECRET?.length || 0,
    });
  }

  // 更新会话（刷新令牌）
  const { response, refreshedUser } = await updateSessionMiddleware(request);

  // 检查用户认证状态
  // 优先使用刷新后的用户信息
  let user = refreshedUser;

  // 如果 token 没有被刷新，从 request 中读取
  // 但如果 refresh token 有效但 access token 无效，getUserFromRequest 会返回用户
  // 此时中间件已经刷新了 token，所以应该优先使用 refreshedUser
  if (!user) {
    // 如果 refreshedUser 为 null，说明 token 有效，不需要刷新
    // 从原始 request 中读取用户信息
    user = await getUserFromRequest(request);
  }

  // 调试日志
  if (process.env.NODE_ENV === "development") {
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith("/admin")) {
      console.log(
        `[Auth Middleware] Path: ${pathname}, User: ${user ? user.email : "null"}`,
      );
    }
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    // 登录页面逻辑
    if (request.nextUrl.pathname === "/admin/login") {
      if (user) {
        // 已登录，重定向到管理后台首页
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      // 未登录，允许访问登录页
      return response;
    }

    // 其他管理后台页面逻辑
    if (!user) {
      // 未登录，重定向到登录页
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
