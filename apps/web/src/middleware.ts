/**
 * Next.js Middleware - i18n + Custom Auth
 *
 * @author junyuzhan
 * @license MIT
 *
 * @env AUTH_JWT_SECRET - JWT 签名密钥
 */

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/auth/middleware";
import { getUserFromRequest } from "@/lib/auth/jwt-helpers";
import { locales, defaultLocale, type Locale } from "./i18n/config";
import { createAdminClient } from "@/lib/database";

// 扩展 globalThis 类型以支持自定义属性
declare global {
  // eslint-disable-next-line no-var
  var middlewareEnvLogged: boolean | undefined;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 开发环境：输出所有环境变量（用于调试，只输出一次）
  if (
    process.env.NODE_ENV === "development" &&
    !globalThis.middlewareEnvLogged
  ) {
    globalThis.middlewareEnvLogged = true;
    console.log(
      "[Middleware] All environment variables:",
      Object.keys(process.env).filter(
        (k) => k.includes("JWT") || k.includes("AUTH"),
      ),
    );
  }

  // Handle custom auth for admin API routes (refresh session for API calls)
  if (pathname.startsWith("/api/admin")) {
    return await updateSession(request);
  }

  // Handle i18n: Set locale cookie if not present
  const localeCookie = request.cookies.get("NEXT_LOCALE")?.value;
  let locale: Locale = defaultLocale;

  // 优先使用 Cookie 中的语言设置
  if (localeCookie && locales.includes(localeCookie as Locale)) {
    locale = localeCookie as Locale;
  }
  // 如果没有 Cookie，默认使用中文（不再根据浏览器语言检测）
  // 用户可以通过语言切换器手动更改语言

  // Handle custom auth for admin routes first (takes priority over locale)
  if (pathname.startsWith("/admin")) {
    const authResponse = await updateSession(request);

    // Set locale cookie on the auth response
    if (!localeCookie || localeCookie !== locale) {
      authResponse.cookies.set("NEXT_LOCALE", locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: "lax",
      });
    }

    return authResponse;
  }

  // 检查首页访问控制（allow_public_home）
  // 首页路径：/ 或 /zh-CN 或 /en 等
  const isHomePage = pathname === "/" || locales.some(loc => pathname === `/${loc}`)
  if (isHomePage) {
    try {
      const adminDb = await createAdminClient()
      const { data: settingData, error: settingError } = await adminDb
        .from('system_settings')
        .select('key, value')
        .eq('key', 'allow_public_home')
        .single()

      if (!settingError && settingData) {
        // 解析 JSON 字符串值
        let allowPublicHome = true // 默认允许
        const value = (settingData as { key: string; value: unknown }).value
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value)
            allowPublicHome = parsed === true
          } catch {
            allowPublicHome = value === 'true'
          }
        } else if (typeof value === 'boolean') {
          allowPublicHome = value
        }

        // 如果不允许公开访问首页，检查用户是否已登录
        if (!allowPublicHome) {
          // 验证用户是否已登录（使用 getUserFromRequest 验证 token）
          const user = await getUserFromRequest(request)
          if (!user) {
            // 未登录，重定向到登录页
            const loginUrl = new URL('/admin/login', request.url)
            loginUrl.searchParams.set('redirect', pathname)
            return NextResponse.redirect(loginUrl)
          }
        }
      }
    } catch (error) {
      // 如果读取设置失败，默认允许访问（优雅降级）
      console.warn('[Middleware] Failed to check allow_public_home setting:', error)
    }
  }

  // Set locale cookie if not present or different (for non-admin routes)
  if (!localeCookie || localeCookie !== locale) {
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files and public API routes
  matcher: [
    // Match admin API routes (for session refresh)
    "/api/admin/:path*",
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
