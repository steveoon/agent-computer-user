/**
 * 🛣️ 路由配置
 * 定义应用中的受保护路由和公开路由
 */

/**
 * 🔐 需要用户认证的路由
 */
export const PROTECTED_ROUTES = [
  "/test-llm-reply",
  "/agent-config",
  "/api/chat",
  "/api/sync",
  "/api/test-llm-reply",
  "/api/desktop-url", // E2B Desktop URL 获取
  "/admin",
] as const;

/**
 * 🌐 公开的API路由（不需要认证）
 */
export const PUBLIC_API_ROUTES = [
  "/api/health", // 健康检查，必须避免触发 Supabase 会话检查
  "/api/auth-status", // 认证状态检查
  "/api/diagnose", // 系统诊断
  "/api/sandbox-status", // 沙箱状态查询
  "/api/kill-desktop", // 终止桌面（清理资源）
  "/api/pause-desktop", // 暂停桌面
] as const;

/**
 * 🚫 不应被middleware处理的路径
 */
export const EXCLUDED_PATHS = [
  "_next/static",
  "_next/image",
  "favicon.ico",
  ...PUBLIC_API_ROUTES,
] as const;

/**
 * 🔍 检查路径是否为受保护路由
 */
export const isProtectedRoute = (pathname: string): boolean => {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
};

/**
 * 🔍 检查路径是否为公开API路由
 */
export const isPublicApiRoute = (pathname: string): boolean => {
  return PUBLIC_API_ROUTES.some(route => pathname.startsWith(route));
};

/**
 * 🔍 检查路径是否为API路由
 */
export const isApiRoute = (pathname: string): boolean => {
  return pathname.startsWith("/api/");
};

/**
 * 📝 路由描述说明
 */
export const ROUTE_DESCRIPTIONS = {
  protected: "需要用户认证才能访问的路由",
  publicApi: "公开的API路由，无需认证即可访问",
  excluded: "完全排除在middleware处理之外的路径",
} as const;
