"use client";

import { useState } from "react";
import { Check, Copy, ScrollText, Terminal, X, Play, Loader2 } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";
import { cn } from "@/lib/utils";
import { APPROVAL } from "@/lib/constants/hitl-constants";

export function BashToolMessage(props: ToolMessageProps) {
  const {
    input,
    state,
    output,
    isLatestMessage,
    status,
    messageId,
    partIndex,
    toolCallId,
    addToolOutput,
    sendMessage,
  } = props;

  const command = input.command as string | undefined;
  const description = input.description as string | undefined;
  const [copied, setCopied] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const truncatedCommand =
    command && command.length > 50 ? command.substring(0, 50) + "..." : command;

  // 显示标签：优先使用 description，否则使用截断的命令
  const displayLabel = description || truncatedCommand;

  // 检测输出类型
  const isError =
    typeof output === "string" &&
    (output.includes("Error") || output.includes("denied"));
  const isDenied = typeof output === "string" && output.includes("denied");

  // 复制命令到剪贴板
  const handleCopy = async () => {
    if (!command) return;

    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // HITL: 处理确认
  const handleConfirm = async () => {
    if (!addToolOutput || !sendMessage || !toolCallId) return;

    setIsConfirming(true);
    try {
      await addToolOutput({
        toolCallId,
        tool: "bash",
        output: APPROVAL.YES,
      });
      sendMessage();
    } catch (err) {
      console.error("Failed to confirm:", err);
      setIsConfirming(false);
    }
  };

  // HITL: 处理拒绝
  const handleDeny = async () => {
    if (!addToolOutput || !sendMessage || !toolCallId) return;

    setIsConfirming(true);
    try {
      await addToolOutput({
        toolCallId,
        tool: "bash",
        output: APPROVAL.NO,
      });
      sendMessage();
    } catch (err) {
      console.error("Failed to deny:", err);
      setIsConfirming(false);
    }
  };

  // 选择主题
  const theme = isError
    ? themes.red
    : isDenied
      ? themes.yellow
      : state === "input-available"
        ? themes.blue
        : themes.zinc;

  // HITL: 等待用户确认的状态
  if (state === "input-available" && addToolOutput && sendMessage && toolCallId) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 p-3 mb-3 text-sm rounded-md border",
          theme.bgColor,
          theme.borderColor
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
            theme.iconBgColor
          )}
        >
          <Terminal className={cn("w-4 h-4", theme.iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn("font-medium mb-2", theme.textColor)}>
            Bash 命令
            {description && (
              <span className="ml-2 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs rounded-md border border-zinc-200 dark:border-zinc-700">
                {description}
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* 安全提示 */}
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              此命令将在本地系统执行，请确认是否继续：
            </div>

            {/* 命令预览 */}
            {command && (
              <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#4c1d95]/40 text-zinc-100 p-3 rounded-lg group shadow-inner">
                <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all">
                  {command}
                </div>
                <button
                  onClick={handleCopy}
                  className={cn(
                    "absolute top-2 right-2 p-1.5 rounded transition-all",
                    "bg-zinc-800 hover:bg-zinc-700",
                    "opacity-0 group-hover:opacity-100",
                    copied && "opacity-100"
                  )}
                  title="复制命令"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-zinc-400" />
                  )}
                </button>
              </div>
            )}

            {/* 确认按钮 */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium",
                  "bg-green-600 hover:bg-green-700 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors shadow-sm"
                )}
              >
                {isConfirming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                确认执行
              </button>
              <button
                onClick={handleDeny}
                disabled={isConfirming}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium",
                  "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border border-zinc-300",
                  "dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors"
                )}
              >
                <X className="h-4 w-4" />
                拒绝
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 显示执行结果（output-available 状态）
  if (state === "output-available" && output) {
    const outputText = typeof output === "string" ? output : JSON.stringify(output, null, 2);

    return (
      <div
        className={cn(
          "flex items-start gap-2 p-3 mb-3 text-sm rounded-md border",
          theme.bgColor,
          theme.borderColor
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0",
            theme.iconBgColor
          )}
        >
          <Terminal className={cn("w-4 h-4", theme.iconColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn("font-medium mb-2", theme.textColor)}>
            Bash 命令
            {description && (
              <span className="ml-2 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs rounded">
                {description}
              </span>
            )}
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-2">
              {truncatedCommand}
            </span>
          </div>

          {/* 命令输出 */}
          <div className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-3 rounded-lg">
            <div className="font-mono text-sm overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
              {outputText}
            </div>
          </div>
        </div>

        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          {isDenied ? (
            <X className="h-4 w-4 text-yellow-600" />
          ) : isError ? (
            <X className="h-4 w-4 text-red-600" />
          ) : (
            <Check className="h-4 w-4 text-green-600" />
          )}
        </div>
      </div>
    );
  }

  // 默认渲染（loading 状态等）
  return (
    <BaseToolMessage
      icon={ScrollText}
      label="Bash 命令"
      detail={displayLabel}
      theme={theme}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    />
  );
}
