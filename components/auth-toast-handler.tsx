"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * 处理认证重定向的 Toast 提示
 *
 * 当用户未登录尝试访问受保护路由时，middleware 会重定向到首页
 * 并添加 auth_required=true 查询参数，此组件检测该参数并显示提示
 */
export function AuthToastHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const authRequired = searchParams.get("auth_required");
    const fromPath = searchParams.get("from");

    if (authRequired === "true") {
      toast.error("需要登录才能访问该页面", {
        description: fromPath ? `您尝试访问: ${fromPath}` : "请先登录您的账户",
        duration: 5000,
      });

      // 清理 URL 参数（避免刷新页面时重复显示）
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_required");
      url.searchParams.delete("from");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  return null; // 此组件不渲染任何内容
}
