"use client";

import { motion } from "motion/react";
import {
  CheckCircle,
  CircleSlash,
  Loader2,
  StopCircle,
  AlertCircle,
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
  // 检查 output 是否是图片类型
  const isImageResult =
    output &&
    typeof output === "object" &&
    "type" in output &&
    output.type === "image" &&
    "data" in output;

  const content =
    state === "output-available" && isImageResult ? (
      <div className="mt-2 relative w-full" style={{ maxHeight }}>
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          <Image
            src={`data:image/${imageFormat};base64,${output.data}`}
            alt="Screenshot"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="rounded-sm object-contain"
            priority
          />
        </div>
      </div>
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
