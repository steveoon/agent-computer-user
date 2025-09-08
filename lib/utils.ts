import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { UIMessage, UIMessagePart, UIDataTypes, UITools } from "ai";
import { analyzer, TokenAnalyzer } from "./token-optimiation";
import type { ToolPart } from "@/types/tool-common";
import { isToolPart, getToolPartState, extractToolName } from "@/types/tool-common";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const ABORTED = "User aborted";

// 🎯 Token优化配置接口
interface TokenConfig {
  maxOutputTokens: number;
  targetTokens: number;
  preserveRecentMessages: number;
}

// 🔧 使用 AI SDK v5 的标准类型
// MessagePart 现在使用 UIMessagePart<UIDataTypes, UITools> 代替

// 🎯 优化策略类型定义
interface OptimizationStrategy {
  type:
    | "none"
    | "aggressive_image_removal"
    | "hybrid_optimization"
    | "aggressive_truncation"
    | "gentle_optimization"
    | "minimal_cleanup";
  reason: string;
}

// 🔧 处理器函数类型
type ProcessorFunction = (
  messages: UIMessage[],
  config?: TokenConfig,
  analyzer?: TokenAnalyzer
) => Promise<UIMessage[]> | UIMessage[];

// 🎯 Token分析结果接口
interface TokenAnalysis {
  totalTokens: number;
  imageTokens: number;
  needsOptimization: boolean;
}

/**
 * 🧠 智能消息优化器 v3.0
 * 基于动态策略选择和管道式处理的高级优化系统
 */
export const prunedMessages = async (
  messages: UIMessage[],
  config: Partial<TokenConfig> = {}
): Promise<UIMessage[]> => {
  const finalConfig: TokenConfig = {
    maxOutputTokens: config.maxOutputTokens || 100000,
    targetTokens: config.targetTokens || 80000,
    preserveRecentMessages: config.preserveRecentMessages || 3,
    ...config,
  };

  try {
    // 🔍 Step 1: 分析当前token使用情况
    const analysis = await analyzer.estimateMessageTokens(messages, finalConfig.targetTokens);

    console.log(
      `📊 Token分析: 总计${analysis.totalTokens} tokens (图片: ${analysis.imageTokens}), 需要优化: ${analysis.needsOptimization}`
    );

    // ✅ 如果token数量合理，直接返回
    if (!analysis.needsOptimization) {
      console.log("✅ Token数量在合理范围内，无需优化");
      return messages;
    }

    // 🎯 Step 2: 智能策略选择
    const strategy = selectOptimizationStrategy(analysis, finalConfig);

    // 🚀 Step 3: 执行优化策略
    const optimizedMessages = await executeStrategy(messages, strategy, finalConfig, analyzer);

    // 📊 Step 4: 验证优化结果
    const finalAnalysis = await analyzer.estimateMessageTokens(
      optimizedMessages,
      finalConfig.targetTokens
    );

    console.log(
      `🎯 优化结果: ${finalAnalysis.totalTokens} tokens` +
        `${finalAnalysis.needsOptimization ? " ⚠️ 仍需优化" : " ✅ 达标"}`
    );

    if (finalAnalysis.totalTokens > finalConfig.maxOutputTokens) {
      console.warn(
        `⚠️ 优化后仍超过最大限制 (${finalAnalysis.totalTokens} > ${finalConfig.maxOutputTokens})`
      );
    }

    return optimizedMessages;
  } catch (error) {
    console.error("🚨 Token优化失败，使用降级策略:", error);
    return fallbackPrunedMessages(messages, finalConfig.preserveRecentMessages);
  } finally {
    // 🧹 确保清理资源
    await analyzer.cleanup();
  }
};

/**
 * 🎯 智能策略选择器 v3.0
 * 基于用户目标和实际情况的动态策略选择
 */
function selectOptimizationStrategy(
  analysis: TokenAnalysis,
  config: TokenConfig
): OptimizationStrategy {
  const { totalTokens, imageTokens } = analysis;
  const { targetTokens } = config;

  // 计算需要削减的token比例
  const reductionRatio = (totalTokens - targetTokens) / totalTokens;
  const imageRatio = imageTokens / totalTokens;

  console.log(`📊 优化分析:
    总tokens: ${totalTokens}
    目标tokens: ${targetTokens}  
    需削减比例: ${(reductionRatio * 100).toFixed(1)}%
    图片占比: ${(imageRatio * 100).toFixed(1)}%`);

  // 🎯 动态策略选择逻辑
  if (reductionRatio <= 0) {
    return { type: "none", reason: "已在目标范围内" };
  }

  // 如果图片占比过高且需要大幅削减
  if (imageRatio > 0.6 && reductionRatio > 0.3) {
    return {
      type: "aggressive_image_removal",
      reason: `图片占${(imageRatio * 100).toFixed(1)}%，需削减${(reductionRatio * 100).toFixed(
        1
      )}%`,
    };
  }

  // 如果图片占比中等，采用混合策略
  if (imageRatio > 0.3 && reductionRatio > 0.2) {
    return {
      type: "hybrid_optimization",
      reason: `图片占${(imageRatio * 100).toFixed(1)}%，需削减${(reductionRatio * 100).toFixed(
        1
      )}%`,
    };
  }

  // 如果需要大幅削减但图片不多，主要截断消息
  if (reductionRatio > 0.5) {
    return {
      type: "aggressive_truncation",
      reason: `需削减${(reductionRatio * 100).toFixed(1)}%，以消息截断为主`,
    };
  }

  // 轻度优化
  if (reductionRatio > 0.1) {
    return {
      type: "gentle_optimization",
      reason: `需削减${(reductionRatio * 100).toFixed(1)}%，温和优化`,
    };
  }

  return {
    type: "minimal_cleanup",
    reason: `轻微超标，仅清理冗余`,
  };
}

/**
 * 🚀 执行优化策略
 */
async function executeStrategy(
  messages: UIMessage[],
  strategy: OptimizationStrategy,
  config: TokenConfig,
  analyzer: TokenAnalyzer
): Promise<UIMessage[]> {
  console.log(`🎯 执行策略: ${strategy.type} - ${strategy.reason}`);

  switch (strategy.type) {
    case "none":
      return messages;

    case "aggressive_image_removal":
      return pipeline([
        removeAllImages, // 移除所有非保护图片
        compressToolResults, // 压缩工具结果
        truncateIfNeeded, // 必要时截断
      ])(messages, config, analyzer);

    case "hybrid_optimization":
      return pipeline([
        removeOldImages, // 移除老图片
        summarizeOldMessages, // 总结旧消息
        compressToolResults, // 压缩工具结果
        validateTokenTarget, // 验证是否达标
      ])(messages, config, analyzer);

    case "aggressive_truncation":
      return pipeline([
        removeOldImages, // 先移除图片
        truncateToTarget, // 大幅截断消息
        preserveContext, // 保留关键上下文
      ])(messages, config, analyzer);

    case "gentle_optimization":
      return pipeline([
        removeRedundantImages, // 移除冗余图片
        compressVerboseMessages, // 压缩冗长消息
        optimizeToolCalls, // 优化工具调用
      ])(messages, config, analyzer);

    case "minimal_cleanup":
    default:
      return pipeline([
        removeOldImages, // 基础图片清理
        cleanupToolResults, // 清理工具结果
      ])(messages, config, analyzer);
  }
}

/**
 * 🔧 管道式处理器
 */
const pipeline =
  (processors: ProcessorFunction[]) =>
  async (
    messages: UIMessage[],
    config: TokenConfig,
    analyzer: TokenAnalyzer
  ): Promise<UIMessage[]> => {
    let currentMessages = messages;

    for (const processor of processors) {
      currentMessages = await processor(currentMessages, config, analyzer);

      // 实时检查是否已达到目标
      const analysis = await analyzer.estimateMessageTokens(currentMessages, config.targetTokens);
      console.log(`📊 处理器${processor.name}完成: ${analysis.totalTokens} tokens`);

      if (!analysis.needsOptimization) {
        console.log("✅ 已达到目标，提前结束优化");
        return currentMessages;
      }
    }

    return currentMessages;
  };

// 🔧 各种处理器函数实现

/**
 * 🗑️ 移除所有非保护图片
 */
const removeAllImages: ProcessorFunction = async (messages, config = {} as TokenConfig) => {
  const protectedCount = Math.min(config.preserveRecentMessages || 3, messages.length);

  return messages.map((message, index) => {
    // 保护最近的消息
    if (index >= messages.length - protectedCount) {
      return message;
    }

    return removeImagesFromMessage(message);
  });
};

/**
 * 🗑️ 移除老旧图片
 */
const removeOldImages: ProcessorFunction = async (messages, config = {} as TokenConfig) => {
  const protectedCount = Math.min(config.preserveRecentMessages || 3, messages.length);

  return messages.map((message, index) => {
    // 保护最近的消息
    if (index >= messages.length - protectedCount) {
      return message;
    }

    return removeImagesFromMessage(message);
  });
};

/**
 * 🔧 从消息中移除图片 (AI SDK v5 版本)
 */
function removeImagesFromMessage(message: UIMessage): UIMessage {
  if (!message.parts) return message;

  const optimizedParts = message.parts.map(part => {
    if (isToolPart(part)) {
      const toolPart = part as ToolPart;
      const state = getToolPartState(toolPart);

      // 对于输入阶段的截图请求，标记为文本
      if ((state === "input-streaming" || state === "input-available") && "input" in toolPart) {
        const input = toolPart.input as Record<string, unknown>;
        if (input?.action === "screenshot") {
          return {
            type: "text",
            text: "Screenshot request [token-optimized]",
          } as UIMessagePart<UIDataTypes, UITools>;
        }
      }

      // 对于输出阶段的图片结果，移除图片数据
      if (state === "output-available" && "output" in toolPart) {
        const output = toolPart.output as Record<string, unknown>;
        if (output?.type === "image") {
          const input = "input" in toolPart ? (toolPart.input as Record<string, unknown>) : {};
          const action = input?.action || "screenshot";
          return {
            type: "text",
            text: `[图片已移除以节省tokens - 操作: ${action}]`,
          } as UIMessagePart<UIDataTypes, UITools>;
        }
      }
    }
    return part;
  });

  return {
    ...message,
    parts: optimizedParts,
  } as UIMessage;
}

/**
 * 🗑️ 移除冗余图片
 */
const removeRedundantImages: ProcessorFunction = async (messages, config = {} as TokenConfig) => {
  // 简化实现：移除连续的截图消息中的重复项
  return removeOldImages(messages, config);
};

/**
 * 🔧 压缩工具结果 (AI SDK v5 版本)
 */
const compressToolResults: ProcessorFunction = async messages => {
  return messages.map(message => {
    if (!message.parts) return message;

    const compressedParts = message.parts.map(part => {
      if (isToolPart(part)) {
        const toolPart = part as ToolPart;
        const state = getToolPartState(toolPart);

        // 只处理输出阶段的结果
        if (state === "output-available" && "output" in toolPart) {
          const output = toolPart.output as Record<string, unknown>;

          // 压缩长文本结果
          if (output?.type === "text" && typeof output.data === "string") {
            const textData = output.data as string;
            if (textData.length > 1000) {
              // 创建压缩后的文本部分
              return {
                type: "text",
                text: textData.substring(0, 500) + "...[truncated]",
              } as UIMessagePart<UIDataTypes, UITools>;
            }
          }
        }
      }
      return part;
    });

    return { ...message, parts: compressedParts } as UIMessage;
  });
};

/**
 * 📝 总结旧消息
 */
const summarizeOldMessages: ProcessorFunction = async (messages, config = {} as TokenConfig) => {
  const protectedCount = Math.min(config.preserveRecentMessages || 3, messages.length);
  const oldMessages = messages.slice(0, messages.length - protectedCount);
  const recentMessages = messages.slice(messages.length - protectedCount);

  if (oldMessages.length === 0) return messages;

  // 创建总结消息（AI SDK v5 格式）
  const summaryMessage: UIMessage = {
    id: `summary-${Date.now()}`,
    role: "system",
    parts: [
      {
        type: "text",
        text: `[对话历史总结: 包含${oldMessages.length}条消息的交互记录]`,
      } as UIMessagePart<UIDataTypes, UITools>,
    ],
  };

  return [summaryMessage, ...recentMessages];
};

/**
 * 🔧 压缩冗长消息 (AI SDK v5 版本)
 */
const compressVerboseMessages: ProcessorFunction = async messages => {
  return messages.map(message => {
    if (!message.parts) return message;

    const compressedParts = message.parts.map(part => {
      // 只处理文本部分
      if (part.type === "text" && part.text && part.text.length > 2000) {
        return {
          ...part,
          text: part.text.substring(0, 1000) + "...[message truncated for token optimization]",
        } as UIMessagePart<UIDataTypes, UITools>;
      }
      return part;
    });

    return {
      ...message,
      parts: compressedParts,
    };
  });
};

/**
 * 🔧 优化工具调用
 */
const optimizeToolCalls: ProcessorFunction = async messages => {
  return compressToolResults(messages);
};

/**
 * 🧹 清理工具结果
 */
const cleanupToolResults: ProcessorFunction = async messages => {
  return compressToolResults(messages);
};

/**
 * ✂️ 必要时截断
 */
const truncateIfNeeded: ProcessorFunction = async (
  messages,
  config = {} as TokenConfig,
  analyzer
) => {
  if (!analyzer) return messages;

  const analysis = await analyzer.estimateMessageTokens(messages, config.targetTokens || 80000);
  if (analysis.needsOptimization) {
    return truncateToTarget(messages, config, analyzer);
  }
  return messages;
};

/**
 * ✅ 验证是否达到目标
 */
const validateTokenTarget: ProcessorFunction = async (
  messages,
  config = {} as TokenConfig,
  analyzer
) => {
  if (!analyzer) return messages;

  const analysis = await analyzer.estimateMessageTokens(messages, config.targetTokens || 80000);
  if (analysis.needsOptimization) {
    console.log("⚠️ 仍未达到目标，可能需要更激进的策略");
  }
  return messages;
};

/**
 * 🔧 保留关键上下文
 */
const preserveContext: ProcessorFunction = async messages => {
  // 简化实现：保持消息原样
  return messages;
};

/**
 * 🎯 智能截断到目标
 */
const truncateToTarget: ProcessorFunction = async (
  messages,
  config = {} as TokenConfig,
  analyzer
) => {
  if (!analyzer) return messages;

  const { targetTokens = 80000, preserveRecentMessages = 3 } = config;
  const optimizedMessages = [...messages];

  // 保护最近的消息
  const protectedCount = Math.min(preserveRecentMessages, messages.length);

  // 从最老的消息开始移除
  while (optimizedMessages.length > protectedCount) {
    const currentAnalysis = await analyzer.estimateMessageTokens(optimizedMessages, targetTokens);

    if (!currentAnalysis.needsOptimization) {
      break;
    }

    // 智能选择要移除的消息（避免破坏对话连贯性）
    const indexToRemove = findBestRemovalIndex(optimizedMessages, protectedCount);

    optimizedMessages.splice(indexToRemove, 1);

    console.log(`📉 移除索引${indexToRemove}的消息，剩余${optimizedMessages.length}条`);
  }

  return optimizedMessages;
};

/**
 * 🧠 智能选择要移除的消息
 */
function findBestRemovalIndex(messages: UIMessage[], protectedCount: number): number {
  const removableRange = messages.length - protectedCount;

  // 优先移除：
  // 1. 纯截图消息
  // 2. 重复性内容
  // 3. 最老的消息

  for (let i = 0; i < removableRange; i++) {
    const message = messages[i];

    // 如果是纯截图消息，优先移除
    if (isPureScreenshotMessage(message)) {
      return i;
    }
  }

  // 默认移除最老的消息
  return 0;
}

/**
 * 🔍 检查是否为纯截图消息 (AI SDK v5 版本)
 */
function isPureScreenshotMessage(message: UIMessage): boolean {
  return (
    message.parts?.every(part => {
      if (!isToolPart(part)) return false;
      const toolPart = part as ToolPart;
      const state = getToolPartState(toolPart);
      if (!state || !("input" in toolPart)) return false;
      const input = toolPart.input as Record<string, unknown>;
      return input?.action === "screenshot";
    }) ?? false
  );
}

/**
 * 🚨 降级策略 (当智能优化失败时)
 */
function fallbackPrunedMessages(messages: UIMessage[], protectedCount: number = 5): UIMessage[] {
  return messages.map((message, messageIndex) => {
    const isOldMessage = messageIndex < messages.length - protectedCount;

    if (!message.parts) return message;

    const optimizedParts = message.parts.map(part => {
      if (isToolPart(part)) {
        const toolPart = part as ToolPart;
        const toolName = extractToolName(toolPart);
        const state = getToolPartState(toolPart);

        if (toolName === "computer" && "input" in toolPart) {
          const input = toolPart.input as Record<string, unknown>;
          if (input?.action === "screenshot") {
            // 如果是输入阶段，替换为文本
            if (state === "input-streaming" || state === "input-available") {
              return {
                type: "text",
                text: "Screenshot request redacted to save tokens",
              } as UIMessagePart<UIDataTypes, UITools>;
            }

            // 如果是输出阶段且是旧消息，移除图片
            if (state === "output-available" && isOldMessage && "output" in toolPart) {
              const output = toolPart.output as Record<string, unknown>;
              if (output?.type === "image") {
                return {
                  type: "text",
                  text: "Screenshot removed to save tokens",
                } as UIMessagePart<UIDataTypes, UITools>;
              }
            }
          }
        }
      }
      return part;
    });

    return {
      ...message,
      parts: optimizedParts,
    } as UIMessage;
  });
}

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
    const errorType = errorObj.type || (errorObj.error as Record<string, unknown>)?.type;
    const errorMessage =
      errorObj.message || (errorObj.error as Record<string, unknown>)?.message || "";

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
    const sandboxErrors = ["sandbox_error", "execution_error", "timeout_error", "connection_error"];

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

    const messageContainsSandboxIssue = sandboxRelatedKeywords.some(keyword =>
      String(errorMessage).toLowerCase().includes(keyword.toLowerCase())
    );

    if (messageContainsSandboxIssue) {
      console.log(`🧹 检测到沙箱相关错误，需要清理: ${errorMessage}`);
      return true;
    }
  }

  // 对于严重的系统错误（如内存不足等），也进行清理
  if (error instanceof Error) {
    const criticalErrors = ["out of memory", "system error", "fatal error", "process crashed"];

    const isCritical = criticalErrors.some(keyword =>
      error.message.toLowerCase().includes(keyword)
    );

    if (isCritical) {
      console.log(`🚨 检测到严重系统错误，需要清理: ${error.message}`);
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
    Return: "Enter",
  };

  // 处理组合键，例如 "ctrl+-" -> "ctrl+minus"
  let result = keySequence;

  // 分解组合键
  const parts = result.split("+");
  if (parts.length > 1) {
    // 映射每个部分，但只映射有问题的字符
    const mappedParts = parts.map(part => {
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
