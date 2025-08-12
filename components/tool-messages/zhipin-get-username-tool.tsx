"use client";

import { BaseToolMessage } from "./base-tool-message";
import { UserCheck } from "lucide-react";
import { ToolMessageProps } from "./types";

/**
 * BOSS直聘获取用户名工具的显示组件
 */
export function ZhipinGetUsernameTool(props: ToolMessageProps) {
  const { state, output, isLatestMessage, messageId, partIndex } = props;

  // 类型安全的结果
  const typedResult = output as
    | {
        text?: string;
      }
    | undefined;

  // 解析结果文本
  const parseResult = (text: string = "") => {
    const isSuccess = text.includes("✅");
    const usernameMatch = text.match(/用户名：(.+?)(?:\n|$)/);
    const selectorMatch = text.match(/使用选择器：(.+?)(?:\n|$)/);
    const isPatternMatch = text.includes("通过模式匹配找到");

    return {
      isSuccess,
      username: usernameMatch?.[1]?.trim() || "",
      selector: selectorMatch?.[1]?.trim() || "",
      isPatternMatch,
      fullText: text,
    };
  };

  const parsedResult = typedResult?.text ? parseResult(typedResult.text) : null;

  // 选择合适的主题
  const theme = parsedResult?.isSuccess
    ? {
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200 dark:border-green-900",
        iconBgColor: "bg-green-100 dark:bg-green-900/50",
        iconColor: "text-green-600 dark:text-green-400",
        textColor: "text-green-800 dark:text-green-200",
        loaderColor: "text-green-600 dark:text-green-400",
      }
    : {
        bgColor: "bg-amber-50 dark:bg-amber-950/20",
        borderColor: "border-amber-200 dark:border-amber-900",
        iconBgColor: "bg-amber-100 dark:bg-amber-900/50",
        iconColor: "text-amber-600 dark:text-amber-400",
        textColor: "text-amber-800 dark:text-amber-200",
        loaderColor: "text-amber-600 dark:text-amber-400",
      };

  if (state === "input-streaming" || state === "input-available") {
    return (
      <BaseToolMessage
        icon={UserCheck}
        label="获取BOSS直聘用户名"
        detail="正在获取当前登录账号..."
        theme={theme}
        state={state}
        messageId={messageId}
        partIndex={partIndex}
        isLatestMessage={isLatestMessage}
      />
    );
  }

  return (
    <BaseToolMessage
      icon={UserCheck}
      label="获取BOSS直聘用户名"
      detail={parsedResult?.isSuccess ? "成功获取用户名" : "获取失败"}
      theme={theme}
      state={state}
      output={typedResult}
      messageId={messageId}
      partIndex={partIndex}
      isLatestMessage={isLatestMessage}
    >
      {parsedResult && (
        <div className="mt-2 space-y-2">
          {parsedResult.isSuccess && parsedResult.username && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">当前登录账号：</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {parsedResult.username}
              </span>
            </div>
          )}

          {parsedResult.selector && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              使用选择器：{parsedResult.selector}
            </div>
          )}

          {parsedResult.isPatternMatch && (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ 通过模式匹配找到，可能需要确认
            </div>
          )}

          {!parsedResult.isSuccess && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {typedResult?.text || "获取用户名失败"}
            </div>
          )}
        </div>
      )}
    </BaseToolMessage>
  );
}
