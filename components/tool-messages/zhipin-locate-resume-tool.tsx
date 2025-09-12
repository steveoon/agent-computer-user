"use client";

import { FileSearch, MapPin } from "lucide-react";
import { BaseToolMessage } from "./base-tool-message";
import { themes, type ToolMessageProps } from "./types";

export function ZhipinLocateResumeToolMessage(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, status, messageId, partIndex } = props;

  // 提取输入参数
  const selector = input.selector as string | undefined;

  // 提取输出结果
  const result =
    output && typeof output === "object" && "success" in output
      ? (output as {
          success: boolean;
          data?: { position?: { x: number; y: number }; message?: string };
          error?: string;
        })
      : null;

  const theme = themes.blue;

  // 格式化选择器显示
  const formatSelector = (sel?: string) => {
    if (!sel) return "";
    return sel.length > 50 ? sel.substring(0, 50) + "..." : sel;
  };

  // 构建标签和详情
  const label = "定位简历画布";
  const detail =
    state === "output-available" && result
      ? result.success
        ? "✅ 已定位到Canvas区域"
        : "❌ 未找到Canvas区域"
      : selector
        ? formatSelector(selector)
        : undefined;

  return (
    <BaseToolMessage
      icon={FileSearch}
      label={label}
      detail={detail}
      theme={theme}
      state={state}
      output={output}
      isLatestMessage={isLatestMessage}
      status={status}
      messageId={messageId}
      partIndex={partIndex}
    >
      {/* 额外的详细信息 */}
      {state === "output-available" && result && (
        <>
          {result.data?.position && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <MapPin className="inline w-3 h-3 mr-1" />
              坐标: ({result.data.position.x}, {result.data.position.y})
            </div>
          )}
          {result.error && (
            <div className="text-xs text-red-500 dark:text-red-400 mt-1">错误: {result.error}</div>
          )}
        </>
      )}
    </BaseToolMessage>
  );
}
