"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { toastConfirm } from "@/lib/ui/toast-confirm";
import type { UIMessage } from "@ai-sdk/react";

/**
 * 工具图片输出类型
 */
type ToolImageOutput = { type: "image"; data: string };

/**
 * 类型守卫：检查是否为工具图片输出
 */
function isToolImageOutput(x: unknown): x is ToolImageOutput {
  return !!x && typeof x === "object" && "type" in x && (x as { type: unknown }).type === "image";
}

interface UseSmartCleanProps {
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  envLimits: {
    maxSizeMB: number;
    maxMessageCount: number;
    warningSizeMB: number;
    warningMessageCount: number;
    autoCleanThreshold: number;
  };
  envInfo: {
    environment: string;
    description: string;
  };
}

export function useSmartClean({ messages, setMessages, envLimits, envInfo }: UseSmartCleanProps) {
  // 🖼️ 智能图片清理 - 移除历史图片，保留最近的5个
  const cleanHistoricalImages = useCallback(() => {
    let imageCount = 0;
    const imageIndices: number[] = [];
    const keepImageCount = 5; // 增加保留的图片数量

    // 统计图片数量和位置（从后往前遍历）
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.parts) {
        for (const part of message.parts) {
          // AI SDK v5: 检查工具部分 (type 是 `tool-${string}` 格式)
          if (
            typeof part.type === "string" &&
            part.type.startsWith("tool-") &&
            "state" in part &&
            part.state === "output-available" &&
            "output" in part &&
            isToolImageOutput(part.output)
          ) {
            imageCount++;
            if (imageCount > keepImageCount) {
              imageIndices.push(i);
            }
          }
        }
      }
    }

    if (imageIndices.length === 0) {
      console.log("📷 没有找到需要清理的历史图片");
      return false;
    }

    // 清理包含历史图片的消息
    const cleanedMessages = messages.filter((_, index) => !imageIndices.includes(index));

    console.log(
      `🖼️ 清理了${imageIndices.length}条包含历史图片的消息，保留最近的${keepImageCount}张图片`
    );
    setMessages(cleanedMessages);

    toast.success(`已清理${imageIndices.length}张历史图片`, {
      description: `保留了最近的${keepImageCount}张图片，请重新提交您的请求`,
      richColors: true,
      position: "top-center",
      duration: 4000,
    });

    return true;
  }, [messages, setMessages]);

  // 🧹 智能消息清理策略 - 优先清理图片，然后清理消息
  const handlePayloadTooLargeError = useCallback(() => {
    const messageCount = messages.length;

    if (messageCount <= 3) {
      // 如果消息很少，说明是单个消息太大
      toast.error("消息内容过大，请尝试分步骤描述或简化需求", {
        description: "建议将复杂任务分解为多个小步骤",
        richColors: true,
        position: "top-center",
        duration: 5000,
      });
      return false; // 不自动清理
    }

    // 🎯 优先尝试清理历史图片
    console.log("🖼️ 优先尝试清理历史图片以减少载荷大小");
    const imageCleanSuccess = cleanHistoricalImages();

    if (imageCleanSuccess) {
      console.log("✅ 图片清理成功，可能已解决载荷过大问题");
      return true; // 图片清理成功，先尝试这个解决方案
    }

    // 🔄 如果没有图片可清理，则进行常规消息清理
    console.log("📝 没有历史图片可清理，执行常规消息清理");

    // 计算需要保留的消息数量（保留最近的40%，至少5条）
    const keepCount = Math.max(5, Math.floor(messageCount * 0.4));
    const removeCount = messageCount - keepCount;

    // 🎯 自动执行清理，不需要用户确认
    console.log(`🔄 自动清理${removeCount}条历史消息，保留最近的${keepCount}条`);

    const recentMessages = messages.slice(-keepCount);
    setMessages(recentMessages);

    toast.success(`已自动清理${removeCount}条历史消息`, {
      description: `保留了最近的${keepCount}条消息，请重新提交您的请求`,
      richColors: true,
      position: "top-center",
      duration: 6000,
    });

    return true; // 表示已清理
  }, [messages, setMessages, cleanHistoricalImages]);

  // 🎯 智能部分清理 - 支持自动和手动清理
  /**
   * 智能清理消息历史
   * @param autoClean - 是否自动清理（true: 自动清理不需要确认, false: 手动清理需要用户确认）
   * @returns
   *   - 自动清理模式：立即执行清理并返回 true
   *   - 手动清理模式：显示确认对话框并立即返回 false（清理操作在用户确认后异步执行）
   *
   * 注意：手动清理模式下，函数会立即返回 false，实际清理会在用户点击确认后才执行。
   * 这是从 window.confirm（同步阻塞）到 toastConfirm（异步非阻塞）的行为变化。
   */
  const smartClean = useCallback(
    (autoClean = false) => {
      if (messages.length <= 2) {
        if (!autoClean) {
          toast.info("消息太少，无需清理", {
            richColors: true,
            position: "top-center",
          });
        }
        return false;
      }

      const keepCount = Math.ceil(messages.length / 2);
      const removeCount = messages.length - keepCount;
      const recentMessages = messages.slice(-keepCount);

      // 🎯 自动清理模式
      if (autoClean) {
        setMessages(recentMessages);
        toast.success(`已自动清理${removeCount}条历史消息`, {
          description: `保持了最近的${keepCount}条消息`,
          richColors: true,
          position: "top-center",
          duration: 6000,
        });
        return true;
      }

      // 手动清理模式 - 使用 toast 确认
      toastConfirm({
        title: "清理历史消息",
        description: `保留最近的${keepCount}条消息，清理其余${removeCount}条历史记录？`,
        confirmLabel: "确定清理",
        cancelLabel: "取消",
        onConfirm: () => {
          setMessages(recentMessages);
          toast.success(`已清理${removeCount}条历史消息`, {
            description: `保持了最近的${keepCount}条消息`,
            richColors: true,
            position: "top-center",
            duration: 4000,
          });
        },
      });

      return false;
    },
    [messages, setMessages]
  );

  // 清空对话记录
  /**
   * 清空所有对话记录
   * 显示确认对话框，用户确认后异步清空消息
   *
   * 注意：此函数不会阻塞，会立即返回。清空操作在用户点击确认后才执行。
   * 这是从 window.confirm（同步阻塞）到 toastConfirm（异步非阻塞）的行为变化。
   */
  const clearMessages = useCallback(() => {
    if (messages.length === 0) {
      toast.info("对话记录已经为空", {
        richColors: true,
        position: "top-center",
      });
      return;
    }

    // 使用 toast 确认
    toastConfirm({
      title: "清空对话记录",
      description: "确定要清空所有对话记录吗？此操作无法撤销。",
      confirmLabel: "确定清空",
      cancelLabel: "取消",
      variant: "destructive",
      onConfirm: () => {
        setMessages([]);
        toast.success("对话记录已清空", {
          richColors: true,
          position: "top-center",
        });
      },
    });
  }, [messages, setMessages]);

  // 检查是否需要显示清理提示
  const checkCleanThreshold = useCallback(() => {
    const messageCount = messages.length;

    // 改为每16条消息检查一次，减少检查频率
    if (messageCount > 0 && messageCount % 16 === 0) {
      console.log(`📝 对话已达到${messageCount}条消息`);

      // 🚨 环境自适应自动清理
      if (messageCount >= envLimits.autoCleanThreshold) {
        console.warn(
          `🔄 消息数量超过${envLimits.autoCleanThreshold}条，执行自动清理 (${envInfo.environment}环境优化)`
        );
        smartClean(true);
        return;
      }

      // 🟡 只在接近自动清理阈值时才提示
      if (messageCount >= envLimits.autoCleanThreshold - 10) {
        toast.warning("对话历史较长", {
          description: `当前${messageCount}条消息，接近系统限制`,
          richColors: true,
          position: "top-center",
          duration: 5000,
          action: {
            label: "立即清理",
            onClick: () => smartClean(false),
          },
        });
      }
      // 移除温和提示，减少用户干扰
    }
  }, [messages.length, smartClean, envLimits, envInfo]);

  // 预检查消息大小 - 仅用于日志记录，不再主动触发清理
  const checkMessageSize = useCallback(() => {
    const messageSize = JSON.stringify(messages).length;
    const estimatedSizeMB = messageSize / (1024 * 1024);
    const messageCount = messages.length;

    console.log(`📊 消息历史大小: ${estimatedSizeMB.toFixed(2)}MB (${messageCount}条消息)`);

    // 仅记录日志，不再自动清理或显示提示
    if (estimatedSizeMB > envLimits.maxSizeMB || messageCount > envLimits.maxMessageCount) {
      console.warn(`⚠️ 消息历史超过${envInfo.environment}环境建议限制，但不会自动清理`);
    }

    return false; // 始终返回 false，不触发清理
  }, [messages, envLimits, envInfo]);

  return {
    smartClean,
    clearMessages,
    handlePayloadTooLargeError,
    cleanHistoricalImages,
    checkCleanThreshold,
    checkMessageSize,
  };
}
