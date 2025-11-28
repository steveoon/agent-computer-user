"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * 带有 loading 状态的导航链接组件
 *
 * 解决 Next.js Server Component 渲染导致的跳转延迟问题
 * 在点击后立即显示 loading 状态，提供即时的用户反馈
 *
 * 特性：
 * - 点击后立即显示 loading 状态
 * - 自动检测路由变化或超时后恢复状态
 * - 防止重复点击
 * - 支持浏览器标准行为（Ctrl/Cmd+点击新标签、右键菜单等）
 * - 可访问性：包含 aria-busy 状态
 */
export function NavLink({ href, children, className, onClick }: NavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);

  // 监听路由变化，重置 loading 状态
  useEffect(() => {
    if (!isNavigating) return;

    // 如果路由没有变化（被 middleware 拦截），2 秒后自动恢复
    const timeout = setTimeout(() => {
      setIsNavigating(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [pathname, isNavigating]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 检测是否为带修饰键的点击（Ctrl/Cmd/Shift/Alt）或非左键点击
    // 这些情况下应保留浏览器默认行为（新标签打开、右键菜单等）
    const isModifiedClick =
      e.button !== 0 || // 非左键点击
      e.metaKey || // Cmd键 (Mac)
      e.ctrlKey || // Ctrl键
      e.shiftKey || // Shift键
      e.altKey; // Alt键

    // 如果是修饰键点击，允许浏览器默认行为
    if (isModifiedClick) {
      return;
    }

    // 普通左键点击：拦截默认行为，使用客户端路由
    e.preventDefault();

    // 调用可选的 onClick 回调
    onClick?.();

    // 设置 loading 状态
    setIsNavigating(true);

    // 执行导航
    router.push(href);
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-busy={isNavigating}
      aria-disabled={isNavigating}
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors relative",
        isNavigating && "pointer-events-none",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 transition-opacity duration-200",
          isNavigating ? "opacity-0" : "opacity-100"
        )}
      >
        {children}
      </span>
      {isNavigating && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        </span>
      )}
    </a>
  );
}
