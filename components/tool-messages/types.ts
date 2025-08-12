import type { LucideIcon } from "lucide-react";
import type { ToolPartState } from "@/types/tool-common";

/**
 * AI SDK v5 工具消息属性
 */
export interface ToolMessageProps {
  toolName: string;
  input: Record<string, unknown>;
  state: ToolPartState;
  output?: unknown;
  errorText?: string;
  isLatestMessage?: boolean;
  status?: string;
  messageId: string;
  partIndex: number;
}

export interface ToolTheme {
  bgColor: string;
  borderColor: string;
  iconBgColor: string;
  iconColor: string;
  textColor: string;
  loaderColor: string;
}

export interface ToolConfig {
  icon: LucideIcon;
  defaultTheme: ToolTheme;
  render: (props: ToolMessageProps) => React.ReactElement;
}

export type ToolRegistry = Record<string, ToolConfig>;

// 预定义的颜色主题
export const themes = {
  zinc: {
    bgColor: "bg-zinc-50 dark:bg-zinc-900/20",
    borderColor: "border-zinc-200 dark:border-zinc-800",
    iconBgColor: "bg-zinc-100 dark:bg-zinc-800",
    iconColor: "text-zinc-600 dark:text-zinc-400",
    textColor: "text-zinc-800 dark:text-zinc-200",
    loaderColor: "text-zinc-500",
  },
  green: {
    bgColor: "bg-green-50 dark:bg-green-900/20",
    borderColor: "border-green-200 dark:border-green-800",
    iconBgColor: "bg-green-100 dark:bg-green-800",
    iconColor: "text-green-600 dark:text-green-400",
    textColor: "text-green-800 dark:text-green-200",
    loaderColor: "text-green-500",
  },
  blue: {
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    iconBgColor: "bg-blue-100 dark:bg-blue-800",
    iconColor: "text-blue-600 dark:text-blue-400",
    textColor: "text-blue-800 dark:text-blue-200",
    loaderColor: "text-blue-500",
  },
  purple: {
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    iconBgColor: "bg-purple-100 dark:bg-purple-800",
    iconColor: "text-purple-600 dark:text-purple-400",
    textColor: "text-purple-800 dark:text-purple-200",
    loaderColor: "text-purple-500",
  },
  red: {
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
    iconBgColor: "bg-red-100 dark:bg-red-800",
    iconColor: "text-red-600 dark:text-red-400",
    textColor: "text-red-800 dark:text-red-200",
    loaderColor: "text-red-500",
  },
  yellow: {
    bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    iconBgColor: "bg-yellow-100 dark:bg-yellow-800",
    iconColor: "text-yellow-600 dark:text-yellow-400",
    textColor: "text-yellow-800 dark:text-yellow-200",
    loaderColor: "text-yellow-500",
  },
  orange: {
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    borderColor: "border-orange-200 dark:border-orange-800",
    iconBgColor: "bg-orange-100 dark:bg-orange-800",
    iconColor: "text-orange-600 dark:text-orange-400",
    textColor: "text-orange-800 dark:text-orange-200",
    loaderColor: "text-orange-500",
  },
  indigo: {
    bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
    borderColor: "border-indigo-200 dark:border-indigo-800",
    iconBgColor: "bg-indigo-100 dark:bg-indigo-800",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    textColor: "text-indigo-800 dark:text-indigo-200",
    loaderColor: "text-indigo-500",
  },
  amber: {
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    iconBgColor: "bg-amber-100 dark:bg-amber-800",
    iconColor: "text-amber-600 dark:text-amber-400",
    textColor: "text-amber-800 dark:text-amber-200",
    loaderColor: "text-amber-500",
  },
} as const;