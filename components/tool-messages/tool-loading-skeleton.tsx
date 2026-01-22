/**
 * 工具消息加载骨架组件
 *
 * 在懒加载工具组件时显示，提供视觉反馈
 */
import type { LucideIcon } from "lucide-react";
import type { ToolTheme } from "./types";

interface ToolLoadingSkeletonProps {
  toolName: string;
  icon: LucideIcon;
  theme: ToolTheme;
}

export function ToolLoadingSkeleton({ toolName, icon: Icon, theme }: ToolLoadingSkeletonProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${theme.bgColor} ${theme.borderColor} animate-pulse`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-md ${theme.iconBgColor}`}>
          <Icon className={`h-4 w-4 ${theme.iconColor}`} />
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          {/* Title */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${theme.textColor}`}>{toolName}</span>
            <div className={`h-4 w-16 bg-current opacity-20 rounded ${theme.loaderColor}`} />
          </div>

          {/* Skeleton lines */}
          <div className="space-y-1.5">
            <div className={`h-3 w-3/4 bg-current opacity-10 rounded ${theme.loaderColor}`} />
            <div className={`h-3 w-1/2 bg-current opacity-10 rounded ${theme.loaderColor}`} />
          </div>
        </div>

        {/* Loading spinner */}
        <div className={`animate-spin h-4 w-4 ${theme.loaderColor}`}>
          <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
