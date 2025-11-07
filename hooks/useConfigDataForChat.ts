import { useEffect, useState } from "react";
import { configService } from "@/lib/services/config.service";
import type { ZhipinData, SystemPromptsConfig, ReplyPromptsConfig, BrandPriorityStrategy } from "@/types";

interface ConfigDataForChat {
  configData: ZhipinData | null;
  systemPrompts: SystemPromptsConfig | null;
  replyPrompts: ReplyPromptsConfig | null;
  activeSystemPrompt: keyof SystemPromptsConfig;
  brandPriorityStrategy: BrandPriorityStrategy;
  isLoading: boolean;
  error: string | null;
}

/**
 * 🔧 聊天配置数据Hook
 * 为聊天API调用准备所需的配置数据
 */
export function useConfigDataForChat(): ConfigDataForChat {
  const [state, setState] = useState<ConfigDataForChat>({
    configData: null,
    systemPrompts: null,
    replyPrompts: null,
    activeSystemPrompt: "bossZhipinSystemPrompt",
    brandPriorityStrategy: "smart",
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function loadConfigData() {
      try {
        console.log("🔄 开始加载聊天所需的配置数据...");

        // 🎯 优化：只调用一次 getConfig，避免5次重复的 I/O 和反序列化
        const config = await configService.getConfig();

        if (!config) {
          throw new Error("配置数据未找到");
        }

        console.log("✅ 配置数据加载完成", {
          hasBrandData: !!config.brandData,
          hasSystemPrompts: !!config.systemPrompts,
          hasReplyPrompts: !!config.replyPrompts,
          activeSystemPrompt: config.activeSystemPrompt,
          brandPriorityStrategy: config.brandPriorityStrategy,
        });

        setState({
          configData: config.brandData,
          systemPrompts: config.systemPrompts,
          replyPrompts: config.replyPrompts,
          activeSystemPrompt: config.activeSystemPrompt || "bossZhipinSystemPrompt",
          brandPriorityStrategy: config.brandPriorityStrategy || "smart",
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error("❌ 配置数据加载失败:", error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : "配置数据加载失败",
        }));
      }
    }

    // 只在浏览器环境中加载
    if (typeof window !== "undefined") {
      loadConfigData();
    } else {
      // 服务端环境设置为非加载状态，将使用服务端降级逻辑
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, []);

  return state;
}
