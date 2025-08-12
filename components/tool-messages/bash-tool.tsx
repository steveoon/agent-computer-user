"use client";

import { useState } from "react";
import { Check, Copy, ScrollText, Terminal } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";
import { cn } from "@/lib/utils";

export function BashToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;
  const command = input.command as string | undefined;
  const [copied, setCopied] = useState(false);

  const truncatedCommand =
    command && command.length > 50 ? command.substring(0, 50) + "..." : command;

  // 处理本地模式的特殊输出
  const isLocalMode = typeof output === "string" && output.includes("📋 本地 Bash 命令预览");
  const isError = typeof output === "string" && output.includes("❌");

  // 提取命令（从 markdown 代码块中）
  const extractCommand = (text: string): string | null => {
    const match = text.match(/```bash\n([^`]+)\n```/);
    return match ? match[1] : null;
  };

  const handleCopy = async () => {
    if (!output || typeof output !== "string") return;

    const commandToCopy = extractCommand(output) || command;
    if (!commandToCopy) return;

    try {
      await navigator.clipboard.writeText(commandToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // 选择主题
  const theme = isError ? themes.red : isLocalMode ? themes.yellow : themes.zinc;

  // 如果是本地模式，渲染自定义内容
  if (output && typeof output === "string" && isLocalMode && state === "output-available") {
    const extractedCommand = extractCommand(output);

    return (
      <div
        className={`flex items-start gap-2 p-3 mb-3 text-sm ${theme.bgColor} rounded-md border ${theme.borderColor}`}
      >
        <div
          className={`flex items-center justify-center w-8 h-8 ${theme.iconBgColor} rounded-full flex-shrink-0`}
        >
          <Terminal className={`w-4 h-4 ${theme.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-medium ${theme.textColor} mb-2`}>
            Bash 命令
            <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-2">
              {truncatedCommand}
            </span>
          </div>

          <div className="space-y-3">
            {/* 警告信息 */}
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ 安全提示：此命令需要在您的本地系统上执行。
            </div>

            {/* 命令预览 */}
            {extractedCommand && (
              <div className="relative bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-3 rounded-lg group">
                <div className="font-mono text-sm overflow-x-auto">
                  <pre>{extractedCommand}</pre>
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

            {/* 执行指南 */}
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              如需执行此命令：
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>复制上面的命令</li>
                <li>打开您的终端应用</li>
                <li>粘贴并执行命令</li>
              </ol>
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              ⚡ 提示：在 E2B 沙箱模式下可以自动执行命令，更加安全便捷。
            </div>
          </div>
        </div>
        <div className="w-5 h-5 flex items-center justify-center">
          <Check className="h-4 w-4 text-green-600" />
        </div>
      </div>
    );
  }

  // 默认渲染
  return (
    <BaseToolMessage
      icon={ScrollText}
      label="Bash 命令"
      detail={truncatedCommand}
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
