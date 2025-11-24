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
import type { ToolTheme } from "./types";
import type { ToolPartState } from "@/types/tool-common";

interface ScreenshotToolMessageProps {
  icon: LucideIcon;
  label: string;
  theme: ToolTheme;
  state: ToolPartState;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  isLatestMessage?: boolean;
  status?: string;
  messageId: string;
  partIndex: number;
  imageFormat?: "png" | "jpeg";
  maxHeight?: string;
}

export function ScreenshotToolMessage({
  icon: Icon,
  label,
  theme,
  state,
  output,
  errorText: _errorText,
  isLatestMessage,
  status,
  messageId,
  partIndex,
  imageFormat = "png",
  maxHeight = "500px",
}: ScreenshotToolMessageProps) {
  // 检查 output 是否是图片类型（支持 base64 data 或 URL）
  const isImageResult =
    output &&
    typeof output === "object" &&
    "type" in output &&
    output.type === "image" &&
    ("data" in output || "url" in output);

  // 判断是否是 OSS URL
  const isOssUrl =
    isImageResult && "url" in output && output.url && (output.url as string).startsWith("oss://");

  // 获取图片源
  const getImageSrc = () => {
    if (!isImageResult) return null;

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
        <span className={`font-medium ${theme.textColor} leading-5`}>{label}</span>
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
