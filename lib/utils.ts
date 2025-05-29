import { UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ABORTED = "User aborted";

export const prunedMessages = (messages: UIMessage[]): UIMessage[] => {
  if (messages.at(-1)?.role === "assistant") {
    return messages;
  }

  return messages.map((message, messageIndex) => {
    // 对于旧消息，更激进地清理截图数据
    const isOldMessage = messageIndex < messages.length - 5; // 保留最近5条消息的图片

    message.parts = message.parts.map((part) => {
      if (part.type === "tool-invocation") {
        if (
          part.toolInvocation.toolName === "computer" &&
          part.toolInvocation.args.action === "screenshot"
        ) {
          // 对于 call 状态的截图请求
          if (part.toolInvocation.state === "call") {
            return {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                result: {
                  type: "text",
                  text: "Screenshot request redacted to save tokens",
                },
              },
            };
          }

          // 对于已完成的截图结果
          if (
            part.toolInvocation.state === "result" &&
            part.toolInvocation.result &&
            part.toolInvocation.result.type === "image"
          ) {
            // 如果是旧消息，完全移除图片数据
            if (isOldMessage) {
              return {
                ...part,
                toolInvocation: {
                  ...part.toolInvocation,
                  result: {
                    type: "text",
                    text: "Screenshot removed to save tokens",
                  },
                },
              };
            }

            // 近期消息保留原始图片数据，实际压缩在 server-actions.ts 中处理
          }
        }
        return part;
      }
      return part;
    });
    return message;
  });
};

// 判断是否需要清理沙箱的公共函数
export function shouldCleanupSandbox(error: unknown): boolean {
  // 如果是字符串错误，检查是否包含沙箱相关的关键词
  if (typeof error === "string") {
    return (
      error.includes("sandbox") ||
      error.includes("desktop") ||
      error.includes("connection lost") ||
      error.includes("timeout")
    );
  }

  // 如果是对象错误，检查错误类型
  if (error && typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    const errorType =
      errorObj.type || (errorObj.error as Record<string, unknown>)?.type;
    const errorMessage =
      errorObj.message ||
      (errorObj.error as Record<string, unknown>)?.message ||
      "";

    // 这些错误类型不需要清理沙箱（外部服务问题）
    const externalServiceErrors = [
      "overloaded_error", // API服务过载
      "rate_limit_error", // 速率限制
      "authentication_error", // 认证错误
      "invalid_request_error", // 请求格式错误
      "api_error", // 通用API错误
      "network_error", // 网络错误（临时）
      "billing_error", // 计费问题
    ];

    if (externalServiceErrors.includes(errorType as string)) {
      console.log(`🔄 外部服务错误 (${errorType}), 保留沙箱环境`);
      return false;
    }

    // 这些错误类型需要清理沙箱（沙箱环境问题）
    const sandboxErrors = [
      "sandbox_error",
      "execution_error",
      "timeout_error",
      "connection_error",
    ];

    if (sandboxErrors.includes(errorType as string)) {
      console.log(`🧹 沙箱环境错误 (${errorType}), 需要清理`);
      return true;
    }

    // 检查错误消息中是否包含沙箱相关内容
    const sandboxRelatedKeywords = [
      "sandbox",
      "desktop",
      "e2b",
      "command execution",
      "screenshot failed",
      "mouse click failed",
      "connection lost",
      "session expired",
    ];

    const messageContainsSandboxIssue = sandboxRelatedKeywords.some((keyword) =>
      String(errorMessage).toLowerCase().includes(keyword.toLowerCase())
    );

    if (messageContainsSandboxIssue) {
      console.log(`🧹 检测到沙箱相关错误，需要清理: ${errorMessage}`);
      return true;
    }
  }

  // 对于严重的系统错误（如内存不足等），也进行清理
  if (error instanceof Error) {
    const criticalErrors = [
      "out of memory",
      "system error",
      "fatal error",
      "process crashed",
    ];

    const isCritical = criticalErrors.some((keyword) =>
      error.message.toLowerCase().includes(keyword)
    );

    if (isCritical) {
      console.log(`🧹 检测到严重系统错误，需要清理: ${error.message}`);
      return true;
    }
  }

  // 默认情况下不清理沙箱，避免误杀
  console.log(`⚡ 未知错误类型，保留沙箱环境，错误详情:`, error);
  return false;
}

// 键映射函数 - 处理E2B/xdo特殊字符
export const mapKeySequence = (keySequence: string): string => {
  // 只映射真正有问题的特殊字符
  const problematicKeyMappings: Record<string, string> = {
    // 确认有问题的字符
    "-": "minus",
    "+": "plus",
    // 如果发现其他有问题的字符，可以在这里添加
    "=": "equal",
    "[": "bracketleft",
    "]": "bracketright",
    "`": "grave",
    "~": "tilde",
    "|": "bar",
    "\\": "backslash",
    ":": "colon",
    ";": "semicolon",
  };

  // 处理组合键，例如 "ctrl+-" -> "ctrl+minus"
  let result = keySequence;

  // 分解组合键
  const parts = result.split("+");
  if (parts.length > 1) {
    // 映射每个部分，但只映射有问题的字符
    const mappedParts = parts.map((part) => {
      const trimmedPart = part.trim();

      // 只映射真正有问题的字符，其他保持原样
      return problematicKeyMappings[trimmedPart] || trimmedPart;
    });

    result = mappedParts.join("+");
  } else {
    // 单个键的映射
    result = problematicKeyMappings[result] || result;
  }

  // 只在实际映射发生时才输出日志
  if (result !== keySequence) {
    console.log(`🎹 键映射: "${keySequence}" -> "${result}"`);
  }

  return result;
};
