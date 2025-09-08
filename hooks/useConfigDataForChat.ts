import { useEffect, useState } from "react";
import {
  getBrandData,
  getSystemPrompts,
  getReplyPrompts,
  getActiveSystemPromptType,
} from "@/lib/services/config.service";
import type { ZhipinData, SystemPromptsConfig, ReplyPromptsConfig } from "@/types";

interface ConfigDataForChat {
  configData: ZhipinData | null;
  systemPrompts: SystemPromptsConfig | null;
  replyPrompts: ReplyPromptsConfig | null;
  activeSystemPrompt: keyof SystemPromptsConfig;
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
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function loadConfigData() {
      try {
        console.log("🔄 开始加载聊天所需的配置数据...");

        // 并行加载所有配置数据
        const [brandData, systemPromptsData, replyPromptsData, activePrompt] = await Promise.all([
          getBrandData(),
          getSystemPrompts(),
          getReplyPrompts(),
          getActiveSystemPromptType(),
        ]);

        console.log("✅ 配置数据加载完成", {
          hasBrandData: !!brandData,
          hasSystemPrompts: !!systemPromptsData,
          hasReplyPrompts: !!replyPromptsData,
          activeSystemPrompt: activePrompt,
        });

        setState({
          configData: brandData,
          systemPrompts: systemPromptsData,
          replyPrompts: replyPromptsData,
          activeSystemPrompt: activePrompt,
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
