import { createAnthropic } from "@ai-sdk/anthropic";
import { createProviderRegistry } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createCustomOpenRouter } from "./providers/openrouter-custom";
import { createCustomOpenAI } from "./providers/openai-custom";
import type { ProviderConfig } from "@/lib/config/models";

/**
 * 🤖 动态模型注册表 - 基于配置创建provider
 */

// 创建动态registry
export function createDynamicRegistry(providerConfigs: Record<string, ProviderConfig>) {
  return createProviderRegistry(
    {
      // Anthropic provider
      anthropic: createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: providerConfigs.anthropic?.baseURL || "https://c-z0-api-01.hash070.com/v1",
      }),

      // OpenAI provider (使用自定义实现以兼容代理服务器)
      openai: createCustomOpenAI({
        apiKey: process.env.ANTHROPIC_API_KEY,
        baseURL: providerConfigs.openai?.baseURL || "https://c-z0-api-01.hash070.com/v1",
      }),

      // OpenRouter provider (使用自定义实现来修复 Kimi K2 的问题)
      // Note: @openrouter/ai-sdk-provider 尚未完全支持 AI SDK v6
      // TODO: 待 @openrouter/ai-sdk-provider 更新后移除此类型断言
      openrouter: createCustomOpenRouter({
        baseURL: providerConfigs.openrouter?.baseURL || "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,

      // OhMyGPT provider
      ohmygpt: createOpenAICompatible({
        name: "ohmygpt",
        baseURL: providerConfigs.ohmygpt?.baseURL || "https://c-z0-api-01.hash070.com/v1",
        apiKey: process.env.ANTHROPIC_API_KEY,
      }),

      moonshotai: createOpenAICompatible({
        name: "moonshotai",
        baseURL: providerConfigs.moonshotai?.baseURL || "https://api.moonshot.cn/v1",
        apiKey: process.env.MOONSHOT_API_KEY,
      }),

      deepseek: createOpenAICompatible({
        name: "deepseek",
        baseURL: providerConfigs.deepseek?.baseURL || "https://api.deepseek.com/v1",
        apiKey: process.env.DEEPSEEK_API_KEY,
      }),

      // Google provider
      google: createGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL:
          providerConfigs.google?.baseURL || "https://generativelanguage.googleapis.com/v1beta",
      }),

      // Qwen provider
      qwen: createOpenAICompatible({
        name: "qwen",
        apiKey: process.env.DASHSCOPE_API_KEY,
        baseURL:
          providerConfigs.qwen?.baseURL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      }),
    },
    { separator: "/" }
  );
}

// 缓存registry实例
let cachedRegistry: ReturnType<typeof createProviderRegistry> | null = null;
let lastConfigHash: string | null = null;

// 获取动态registry（带缓存）
export function getDynamicRegistry(providerConfigs: Record<string, ProviderConfig>) {
  const configHash = JSON.stringify(providerConfigs);

  // 如果配置没有变化且有缓存，直接返回缓存
  if (cachedRegistry && lastConfigHash === configHash) {
    return cachedRegistry;
  }

  // 创建新的registry
  cachedRegistry = createDynamicRegistry(providerConfigs);
  lastConfigHash = configHash;

  console.log(
    "[DYNAMIC REGISTRY] 创建新的动态registry，配置哈希:",
    configHash.substring(0, 16) + "..."
  );

  return cachedRegistry;
}
