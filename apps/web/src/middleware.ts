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
import { updateSessionMiddleware } from "@/lib/auth/jwt-helpers";
import { locales, defaultLocale, type Locale } from "./i18n/config";

function applyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value, {
      path: c.path ?? "/",
      domain: c.domain,
      maxAge: c.maxAge,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite as boolean | "lax" | "strict" | "none" | undefined,
      partitioned: c.partitioned,
      priority: c.priority,
    });
  });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (process.env.NODE_ENV === "production" && pathname.startsWith("/test-turnstile")) {
    return new NextResponse(null, { status: 404 });
  }

  // Handle custom auth for admin / worker / realtime API routes (refresh access cookie)
  if (
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/worker") ||
    pathname.startsWith("/api/realtime")
  ) {
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
  let homeSessionResponse: NextResponse | null = null;
  const isHomePage = pathname === "/" || locales.some(loc => pathname === `/${loc}`)
  if (isHomePage) {
    try {
      // 使用 fetch 调用公开 API 获取设置，避免在 Edge Runtime 中使用 Node.js 模块
      const settingsUrl = new URL('/api/public/settings', request.url)
      const settingsResponse = await fetch(settingsUrl.toString(), {
        headers: {
          'Accept': 'application/json',
        },
      })
      
      if (settingsResponse.ok) {
        const body = (await settingsResponse.json()) as {
          data?: { allow_public_home?: boolean }
          allow_public_home?: boolean
        }
        const settings = body.data ?? body
        const allowPublicHome = settings.allow_public_home !== false // 默认允许

        // 如果不允许公开访问首页，检查用户是否已登录（先尝试 refresh 写回 access）
        if (!allowPublicHome) {
          const { response: sessionResponse, refreshedUser } =
            await updateSessionMiddleware(request)
          homeSessionResponse = sessionResponse
          if (!refreshedUser) {
            const loginUrl = new URL("/admin/login", request.url)
            loginUrl.searchParams.set("redirect", pathname)
            const redirect = NextResponse.redirect(loginUrl)
            applyCookies(sessionResponse, redirect)
            return redirect
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
    if (homeSessionResponse) applyCookies(homeSessionResponse, response);
    return response;
  }

  const final = NextResponse.next();
  if (homeSessionResponse) applyCookies(homeSessionResponse, final);
  return final;
}

export const config = {
  // Match all routes except static files and public API routes
  matcher: [
    // Match admin API routes (for session refresh)
    "/api/admin/:path*",
    "/api/worker/:path*",
    "/api/realtime/:path*",
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
