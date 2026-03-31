import { updateSession } from "./lib/utils/supabase/middleware";
import { NextRequest, NextResponse } from "next/server";

// ========== CORS 配置 ==========

/**
 * 允许的源列表
 * 可以通过环境变量配置，格式：ALLOWED_ORIGINS=https://example.com,https://app.example.com
 */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      // 添加你的生产域名
      // "https://yourdomain.com",
      // "https://app.yourdomain.com",
    ];

/**
 * CORS 响应头配置
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Methods": "GET,DELETE,PATCH,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Correlation-Id",
  "Access-Control-Max-Age": "86400", // 预检请求缓存24小时
};

/**
 * 为响应添加 CORS 头
 */
function addCorsHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get("origin");

  // 设置标准 CORS 头
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // 设置 Access-Control-Allow-Origin
  if (origin) {
    // 检查是否在允许列表中
    if (ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    } else if (ALLOWED_ORIGINS.includes("*")) {
      // 如果配置了通配符，允许所有源（不推荐用于生产环境）
      response.headers.set("Access-Control-Allow-Origin", "*");
    }
    // 否则不设置 Allow-Origin，浏览器会阻止跨域请求
  }

  return response;
}

// ========== Open API 鉴权配置 ==========

/**
 * 外部鉴权服务配置
 */
const AUTH_SERVICE_URL = process.env.OPEN_API_AUTH_URL || "https://wolian.cc/api/v1/validate-key";
const AUTH_SERVICE_TIMEOUT = 5000; // 5秒超时

/**
 * Token 缓存配置
 */
const TOKEN_CACHE_TTL = 60_000; // 60秒缓存
const tokenCache = new Map<string, number>(); // token -> expiresAt (ms)

// 导出清理缓存的函数（仅用于测试）
export const clearTokenCache = () => {
  tokenCache.clear();
};

/**
 * 清理过期的缓存项（防止内存泄漏）
 */
function cleanupExpiredCache() {
  const now = Date.now();
  for (const [token, expiresAt] of tokenCache.entries()) {
    if (expiresAt <= now) {
      tokenCache.delete(token);
    }
  }
}

// 定期清理缓存（每5分钟）
if (typeof global !== "undefined" && !global.__cacheCleanupInterval) {
  global.__cacheCleanupInterval = setInterval(cleanupExpiredCache, 5 * 60 * 1000);
}

/**
 * 验证 Open API Token
 * @param authorization Authorization header 值
 * @returns 是否验证通过
 */
async function validateOpenApiToken(authorization: string): Promise<boolean> {
  const now = Date.now();

  // 1. 检查缓存
  const cachedExpiry = tokenCache.get(authorization);
  if (cachedExpiry && cachedExpiry > now) {
    console.log("[Open API Auth] Token validated from cache");
    return true;
  }

  // 2. 调用外部鉴权服务
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_SERVICE_TIMEOUT);

    const response = await fetch(AUTH_SERVICE_URL, {
      method: "GET",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      // 验证成功响应格式 {"isSuccess": true, ...}
      if (data?.isSuccess === true) {
        // 写入缓存
        tokenCache.set(authorization, now + TOKEN_CACHE_TTL);
        console.log("[Open API Auth] Token validated and cached");
        return true;
      }
    }

    console.log(`[Open API Auth] Token validation failed: ${response.status}`);
    return false;
  } catch (error) {
    // 网络错误或超时
    console.error("[Open API Auth] External auth service error:", error);
    // 安全优先：外部服务不可用时拒绝访问
    return false;
  }
}

/**
 * 创建错误响应并添加 CORS 头
 */
function createErrorResponse(
  error: { error: string; message: string; statusCode: number },
  request: NextRequest
): NextResponse {
  const response = NextResponse.json(error, { status: error.statusCode });
  return addCorsHeaders(response, request);
}

/**
 * 处理 Open API 路由的鉴权
 * @param request Next.js 请求对象
 * @returns 如果鉴权失败返回错误响应，成功返回 null
 */
async function handleOpenApiAuth(request: NextRequest): Promise<NextResponse | null> {
  const auth = request.headers.get("authorization");

  // 1. 检查 Authorization header
  if (!auth) {
    return createErrorResponse(
      {
        error: "Unauthorized",
        message: "Missing authorization header",
        statusCode: 401,
      },
      request
    );
  }

  // 2. 检查格式（Bearer token）
  if (!auth.startsWith("Bearer ")) {
    return createErrorResponse(
      {
        error: "Unauthorized",
        message: "Invalid authorization format. Use: Bearer <token>",
        statusCode: 401,
      },
      request
    );
  }

  // 3. 验证 Token
  const isValid = await validateOpenApiToken(auth);
  if (!isValid) {
    return createErrorResponse(
      {
        error: "Unauthorized",
        message: "Invalid or expired API key",
        statusCode: 401,
      },
      request
    );
  }

  // 鉴权成功
  return null;
}

// ========== 主 Proxy 函数 ==========

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 处理 CORS 预检请求（OPTIONS）
  if (request.method === "OPTIONS") {
    // 对于 OPTIONS 请求，直接返回 200 并设置 CORS 头
    const response = new NextResponse(null, { status: 200 });
    return addCorsHeaders(response, request);
  }

  // 2. 检查是否是 Open API 路径
  if (pathname.startsWith("/api/v1/")) {
    // 对 Open API 路径进行特殊鉴权
    const authError = await handleOpenApiAuth(request);
    if (authError) {
      return authError; // 错误响应已包含 CORS 头
    }
    // 鉴权成功，继续处理请求，并添加 CORS 头
    const response = NextResponse.next();
    return addCorsHeaders(response, request);
  }

  // 3. 其他路径使用原有的 Supabase 会话更新逻辑
  const response = await updateSession(request);

  // 4. 如果是 API 路径，也添加 CORS 头
  if (pathname.startsWith("/api/")) {
    return addCorsHeaders(response, request);
  }

  return response;
}

// 🎯 配置 proxy 匹配规则
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (网站图标)
     * - 公开的API路由（不需要认证检查）
     *
     * 注意：/api/v1/* 路径会被匹配，但使用独立的鉴权逻辑
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth-status|api/diagnose|api/sandbox-status|api/kill-desktop|api/pause-desktop).*)",
  ],
};

// TypeScript 全局类型声明
declare global {
  var __cacheCleanupInterval: NodeJS.Timeout | undefined;
}