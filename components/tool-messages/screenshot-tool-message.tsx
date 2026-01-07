"use client";

import { motion } from "motion/react";
import {
  CheckCircle,
  CircleSlash,
  Loader2,
  StopCircle,
  AlertCircle,
  Camera,
  type LucideIcon,
} from "lucide-react";
import { ABORTED } from "@/lib/utils";
import Image from "next/image";
import { themes, type ToolMessageProps, type ToolTheme } from "./types";

// MCP 后端类型
type MCPBackend = "puppeteer" | "playwright";

// MCP 后端标签配置
const MCP_BACKEND_STYLES: Record<MCPBackend, { label: string; className: string }> = {
  puppeteer: {
    label: "Puppeteer",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  playwright: {
    label: "Playwright",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
};

// 扩展 props 以支持来自父组件的自定义参数
interface ScreenshotToolMessageProps extends ToolMessageProps {
  icon?: LucideIcon;
  label?: string;
  theme?: ToolTheme;
  imageFormat?: "png" | "jpeg";
  maxHeight?: string;
}

export function ScreenshotToolMessage(props: ScreenshotToolMessageProps) {
  const {
    state,
    output,
    isLatestMessage,
    status,
    messageId,
    partIndex,
    input,
    // 可选的自定义参数，优先使用传入的值
    icon: customIcon,
    label: customLabel,
    theme: customTheme,
    imageFormat: customImageFormat,
    maxHeight: customMaxHeight,
  } = props;

  // 使用自定义值或默认值
  const Icon = customIcon || Camera;
  const theme = customTheme || themes.zinc;
  const imageFormat = customImageFormat || (input?.type as "png" | "jpeg") || "jpeg";
  const maxHeight = customMaxHeight || "500px";

  // 提取 MCP 后端信息
  let mcpBackend: MCPBackend | undefined;
  if (output && typeof output === "object" && "mcpBackend" in output) {
    mcpBackend = (output as { mcpBackend?: MCPBackend }).mcpBackend;
  }

  // 使用自定义标签或默认标签
  const label = customLabel || "截图";
  // 检查 output 是否是图片类型（支持 base64 data、displayData 或 URL）
  const isImageResult =
    output &&
    typeof output === "object" &&
    "type" in output &&
    output.type === "image" &&
    ("data" in output || "url" in output || "displayData" in output);

  // 判断是否是 OSS URL
  const isOssUrl =
    isImageResult && "url" in output && output.url && (output.url as string).startsWith("oss://");

  // 获取图片源
  const getImageSrc = () => {
    if (!isImageResult) return null;

    // 优先使用 displayData（专门用于 UI 显示的压缩后 base64）
    if ("displayData" in output && output.displayData) {
      return `data:image/${imageFormat};base64,${output.displayData}`;
    }

    // 如果有 base64 data，使用 data URL
    if ("data" in output && output.data) {
      return `data:image/${imageFormat};base64,${output.data}`;
    }

    // 如果有普通 URL（非 OSS），直接返回
    if ("url" in output && output.url && !isOssUrl) {
      return output.url as string;
    }

    return null;
  };

  const imageSrc = getImageSrc();

  const content =
    state === "output-available" && isImageResult ? (
      imageSrc ? (
        // 可以直接显示的图片
        <div className="mt-2 relative w-full flex justify-center" style={{ maxHeight }}>
          <div
            className="relative w-full"
            style={{ aspectRatio: "16/9", maxWidth: `calc(${maxHeight} * 16 / 9)` }}
          >
            <Image
              src={imageSrc}
              alt="Screenshot"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="rounded-sm object-contain"
              priority
              unoptimized={imageSrc.startsWith("http")} // 对外部 URL 禁用优化
            />
          </div>
        </div>
      ) : isOssUrl ? (
        // OSS URL 占位提示
        <div className="mt-2 relative w-full flex justify-center" style={{ maxHeight }}>
          <div
            className="relative w-full bg-gray-100 dark:bg-gray-800 rounded-sm p-8"
            style={{ aspectRatio: "16/9", maxWidth: `calc(${maxHeight} * 16 / 9)` }}
          >
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Camera className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                截图已上传至百炼 OSS
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                图片 URL: {(output.url as string).substring(0, 50)}...
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                使用分析工具可查看图片内容
              </p>
            </div>
          </div>
        </div>
      ) : null
    ) : state === "input-available" || state === "input-streaming" ? (
      <div
        className={`w-full aspect-video rounded-sm ${theme.iconBgColor.replace("bg-", "bg-opacity-20 bg-")} animate-pulse mt-2`}
      ></div>
    ) : null;

  return (
    <motion.div
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      key={`message-${messageId}-part-${partIndex}`}
      className={`flex flex-col gap-1 p-2 mb-3 text-sm ${theme.bgColor} rounded-md border ${theme.borderColor}`}
    >
      {/* 紧凑的横向工具栏 */}
      <div className="flex items-center gap-1.5">
        <div
          className={`flex items-center justify-center w-8 h-8 ${theme.iconBgColor} rounded-full flex-shrink-0`}
        >
          <Icon className={`w-4 h-4 ${theme.iconColor}`} />
        </div>
        <span className={`font-medium ${theme.textColor} leading-5`}>
          {label}
          {mcpBackend && MCP_BACKEND_STYLES[mcpBackend] && (
            <span
              className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded ${MCP_BACKEND_STYLES[mcpBackend].className}`}
            >
              {MCP_BACKEND_STYLES[mcpBackend].label}
            </span>
          )}
        </span>
        <div className="ml-auto w-4 h-4 flex items-center justify-center">
          {state === "input-streaming" || state === "input-available" ? (
            isLatestMessage && status !== "ready" ? (
              <Loader2 className={`animate-spin h-4 w-4 ${theme.loaderColor}`} />
            ) : (
              <StopCircle className="h-4 w-4 text-red-500" />
            )
          ) : state === "output-available" ? (
            output === ABORTED ? (
              <CircleSlash className="h-4 w-4 text-amber-600" />
            ) : (
              <CheckCircle size={14} className="text-green-600" />
            )
          ) : state === "output-error" ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : null}
        </div>
      </div>
      {/* 内容区域 */}
      {content && <div className="-mt-0.5">{content}</div>}
    </motion.div>
  );
}
