"use client";

import { cn } from "@/lib/utils";
import type { AgentStatus } from "@/types/agent";

interface AgentStatusBadgeProps {
  status: AgentStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Agent 状态徽章组件
 * 显示 Agent 的运行状态，带颜色指示
 */
export function AgentStatusBadge({
  status,
  showLabel = true,
  size = "md",
  className,
}: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        size === "sm" ? "text-xs" : "text-sm",
        className
      )}
    >
      {/* 状态圆点 */}
      <span
        className={cn(
          "rounded-full",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          config.dotColor,
          config.animate && "animate-pulse"
        )}
      />
      {/* 状态文字 */}
      {showLabel && (
        <span className={cn("font-medium", config.textColor)}>{config.label}</span>
      )}
    </div>
  );
}

/**
 * 状态配置
 */
const STATUS_CONFIG: Record<
  AgentStatus,
  {
    label: string;
    dotColor: string;
    textColor: string;
    animate: boolean;
  }
> = {
  running: {
    label: "运行中",
    dotColor: "bg-green-500",
    textColor: "text-green-600 dark:text-green-400",
    animate: false,
  },
  stopped: {
    label: "已停止",
    dotColor: "bg-gray-400",
    textColor: "text-gray-500 dark:text-gray-400",
    animate: false,
  },
  starting: {
    label: "启动中",
    dotColor: "bg-yellow-500",
    textColor: "text-yellow-600 dark:text-yellow-400",
    animate: true,
  },
  stopping: {
    label: "停止中",
    dotColor: "bg-yellow-500",
    textColor: "text-yellow-600 dark:text-yellow-400",
    animate: true,
  },
  error: {
    label: "错误",
    dotColor: "bg-red-500",
    textColor: "text-red-600 dark:text-red-400",
    animate: false,
  },
};

/**
 * 获取状态图标（用于按钮等场景）
 */
export function getStatusIcon(status: AgentStatus): string {
  const icons: Record<AgentStatus, string> = {
    running: "▶",
    stopped: "■",
    starting: "⏳",
    stopping: "⏳",
    error: "⚠",
  };
  return icons[status];
}
