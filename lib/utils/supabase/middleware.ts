import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY } from "@/lib/constants";
import { isProtectedRoute, isPublicApiRoute, isApiRoute } from "@/lib/config/routes";

/**
 * 更新会话
 * 用于在服务器组件中更新会话
 * @param request
 * @returns
 */
export const updateSession = async (request: NextRequest) => {
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    if (!SUPABASE_URL || !SUPABASE_PUBLIC_ANON_KEY) {
      console.error("[MIDDLEWARE] Supabase environment variables not set", {
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SUPABASE_PUBLIC_ANON_KEY,
        urlPrefix: SUPABASE_URL ? SUPABASE_URL.substring(0, 20) + "..." : "undefined",
      });
      return response;
    }

    const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // 先更新request的cookies
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

          // 创建新的response，包含更新后的request
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          // 将所有cookies设置到response中，包括options
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // IMPORTANT: getClaims() is recommended for middleware as it doesn't make network requests
    // It only parses the JWT token from cookies, making it much faster and avoiding "Failed to fetch" errors
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims;

    // 记录认证状态用于调试
    console.log("[MIDDLEWARE] Auth check:", {
      path: request.nextUrl.pathname,
      hasUser: !!user,
    });

    const pathname = request.nextUrl.pathname;

    // 如果是公开API路由，直接允许访问（这不应该发生，因为已在matcher中排除）
    if (isPublicApiRoute(pathname)) {
      console.log("[MIDDLEWARE] 公开API路由，允许访问:", pathname);
      return response;
    }

    // 如果是受保护的路由且用户未认证
    if (isProtectedRoute(pathname) && !user) {
      console.log("[MIDDLEWARE] 受保护路由，用户未认证，拒绝访问:", pathname);

      // 对于API路由，返回401错误而不是重定向
      if (isApiRoute(pathname)) {
        return NextResponse.json(
          {
            error: "未授权访问",
            message: "请先登录",
            code: "UNAUTHORIZED",
          },
          { status: 401 }
        );
      }

      // 对于页面路由，重定向到首页并添加认证错误参数
      const redirectUrl = new URL("/", request.url);
      redirectUrl.searchParams.set("auth_required", "true");
      redirectUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  } catch (e) {
    console.error("[MIDDLEWARE] Error:", e);
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
