"use client";

import { BaseToolMessage } from "./base-tool-message";
import { Smartphone, CheckCircle2, XCircle } from "lucide-react";
import { ToolMessageProps } from "./types";

/**
 * BOSS直聘交换微信工具的显示组件
 */
export function ZhipinExchangeWechatTool(props: ToolMessageProps) {
  const { state, output, isLatestMessage, messageId, partIndex } = props;

  // 类型安全的结果
  const typedResult = output as
    | {
        success?: boolean;
        message?: string;
        error?: string;
        details?: {
          exchangeButtonSelector?: string;
          confirmButtonSelector?: string;
          waitTime?: number;
        };
        exchangeButtonClicked?: boolean;
        triedSelectors?: string[];
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
        icon={Smartphone}
        label="交换微信"
        detail="正在交换微信..."
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
      icon={Smartphone}
      label="交换微信"
      detail={typedResult?.message || (typedResult?.success ? "交换成功" : "交换失败")}
      theme={theme}
      state={state}
      output={typedResult}
      messageId={messageId}
      partIndex={partIndex}
      isLatestMessage={isLatestMessage}
    >
      {typedResult?.success && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          <span>微信交换成功，可以在聊天窗口查看对方微信号</span>
        </div>
      )}

      {typedResult?.error && (
        <div className="mt-3 space-y-2">
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <div>错误: {typedResult.error}</div>
              {typedResult.exchangeButtonClicked && (
                <div className="text-xs mt-1">已点击交换按钮，但未能完成确认</div>
              )}
            </div>
          </div>
        </div>
      )}
    </BaseToolMessage>
  );
}
