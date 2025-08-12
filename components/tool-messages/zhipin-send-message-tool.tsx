"use client";

import { BaseToolMessage } from "./base-tool-message";
import { Send } from "lucide-react";
import { ToolMessageProps } from "./types";

/**
 * BOSS直聘发送消息工具的显示组件
 */
export function ZhipinSendMessageTool(props: ToolMessageProps) {
  const { input, state, output, isLatestMessage, messageId, partIndex } = props;

  // 类型安全的参数和结果
  const typedArgs = input as {
    message: string;
    clearBefore?: boolean;
    waitAfterSend?: number;
  };

  const typedResult = output as
    | {
        success?: boolean;
        message?: string;
        error?: string;
        details?: {
          sentText?: string;
          inputSelector?: string;
          sendButtonSelector?: string;
        };
        rawResult?: string;
      }
    | undefined;

  // 选择合适的主题
  const theme = typedResult?.success
    ? {
        bgColor: "bg-green-50 dark:bg-green-950/20",
        borderColor: "border-green-200 dark:border-green-900",
        iconBgColor: "bg-green-100 dark:bg-green-900/50",
        iconColor: "text-green-600 dark:text-green-400",
        textColor: "text-green-800 dark:text-green-200",
        loaderColor: "text-green-600 dark:text-green-400",
      }
    : {
        bgColor: "bg-red-50 dark:bg-red-950/20",
        borderColor: "border-red-200 dark:border-red-900",
        iconBgColor: "bg-red-100 dark:bg-red-900/50",
        iconColor: "text-red-600 dark:text-red-400",
        textColor: "text-red-800 dark:text-red-200",
        loaderColor: "text-red-600 dark:text-red-400",
      };

  if (state === "input-streaming" || state === "input-available") {
    return (
      <BaseToolMessage
        icon={Send}
        label="发送消息"
        detail="正在发送消息..."
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
      icon={Send}
      label="发送消息"
      detail={typedResult?.success ? typedArgs.message : typedResult?.error ? "失败" : undefined}
      theme={theme}
      state={state}
      output={typedResult}
      messageId={messageId}
      partIndex={partIndex}
      isLatestMessage={isLatestMessage}
    />
  );
}
