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
import type { ToolTheme } from "./types";
import type { ToolPartState } from "@/types/tool-common";

interface BaseToolMessageProps {
  icon: LucideIcon;
  label: string;
  detail?: React.ReactNode;
  theme: ToolTheme;
  state: ToolPartState;
  output?: unknown;
  _errorText?: string;
  isLatestMessage?: boolean;
  status?: string;
  messageId: string;
  partIndex: number;
  children?: React.ReactNode;
}

export function BaseToolMessage({
  icon: Icon,
  label,
  detail,
  theme,
  state,
  output,
  isLatestMessage,
  status,
  messageId,
  partIndex,
  children,
}: BaseToolMessageProps) {
  return (
    <motion.div
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      key={`message-${messageId}-part-${partIndex}`}
      className={`flex items-center gap-2 p-2 mb-3 text-sm ${theme.bgColor} rounded-md border ${theme.borderColor}`}
    >
      <div
        className={`flex items-center justify-center w-8 h-8 ${theme.iconBgColor} rounded-full flex-shrink-0`}
      >
        <Icon className={`w-4 h-4 ${theme.iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium flex items-baseline gap-2 ${theme.textColor}`}>
          <span className="truncate">{label}</span>
          {detail && (
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 truncate">
              {detail}
            </span>
          )}
        </div>
        {children}
      </div>
      <div className="w-5 h-5 flex items-center justify-center">
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
    </motion.div>
  );
}
