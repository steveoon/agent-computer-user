/**
 * 🤖 AI模型配置和数据字典
 */

// 模型类别定义
export type ModelCategory = "chat" | "general";

// 模型数据字典
export const MODEL_DICTIONARY = {
  // Qwen 模型
  "qwen/qwen-max-latest": {
    provider: "qwen",
    name: "Qwen Max Latest",
    description: "阿里云通义千问最新旗舰模型",
    categories: ["general"] as ModelCategory[],
  },
  "qwen/qwen-plus-latest": {
    provider: "qwen",
    name: "Qwen Plus Latest",
    description: "阿里云通义千问增强版模型",
    categories: ["general"] as ModelCategory[],
  },

  // Google 模型
  "google/gemini-2.5-flash-preview-04-17": {
    provider: "google",
    name: "Gemini 2.5 Flash Preview",
    description: "Google Gemini 2.5 Flash 预览版",
    categories: ["general"] as ModelCategory[],
  },
  "google/gemini-2.5-pro-preview-05-06": {
    provider: "google",
    name: "Gemini 2.5 Pro Preview",
    description: "Google Gemini 2.5 Pro 预览版",
    categories: ["general"] as ModelCategory[],
  },
  "google/gemini-3-pro-preview": {
    provider: "google",
    name: "Gemini 3 Pro Preview",
    description: "Google Gemini 3 Pro 预览版",
    categories: ["chat", "general"] as ModelCategory[],
  },

  // Anthropic 模型 - 既可以做Chat也可以做General任务
  "anthropic/claude-3-7-sonnet-20250219": {
    provider: "anthropic",
    name: "Claude 3.7 Sonnet",
    description: "Anthropic Claude 3.7 Sonnet",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "anthropic/claude-sonnet-4-5-20250929": {
    provider: "anthropic",
    name: "Claude Sonnet 4.5",
    description: "Anthropic Claude Sonnet 4.5 (最新)",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "anthropic/claude-sonnet-4-20250514": {
    provider: "anthropic",
    name: "Claude Sonnet 4",
    description: "Anthropic Claude Sonnet 4",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "anthropic/claude-haiku-4-5": {
    provider: "anthropic",
    name: "Claude Haiku 4.5",
    description: "Anthropic Claude Haiku 4.5 (最新)",
    categories: ["chat", "general"] as ModelCategory[],
  },

  // OpenAI 模型
  "openai/gpt-5.1": {
    provider: "openai",
    name: "GPT-5.1",
    description: "OpenAI GPT-5.1",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "openai/gpt-5-chat-latest": {
    provider: "openai",
    name: "GPT-5 Chat (最新)",
    description: "OpenAI GPT-5 Chat (最新)",
    categories: ["general"] as ModelCategory[],
  },
  "openai/gpt-5-mini": {
    provider: "openai",
    name: "GPT-5 Mini",
    description: "OpenAI GPT-5 Mini",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "openai/gpt-4o": {
    provider: "openai",
    name: "GPT-4o",
    description: "OpenAI GPT-4o",
    categories: ["general"] as ModelCategory[],
  },

  // OpenRouter 模型
  "openrouter/qwen/qwen3-235b-a22b": {
    provider: "openrouter",
    name: "Qwen3 235B",
    description: "通过OpenRouter访问的Qwen3 235B",
    categories: ["general"] as ModelCategory[],
  },
  "openrouter/qwen/qwen-max": {
    provider: "openrouter",
    name: "Qwen Max (OpenRouter)",
    description: "通过OpenRouter访问的Qwen Max",
    categories: ["general"] as ModelCategory[],
  },
  "openrouter/moonshotai/kimi-k2-0905": {
    provider: "openrouter",
    name: "Kimi K2 0905",
    description: "通过OpenRouter访问的Kimi K2 0905",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "openrouter/anthropic/claude-3.7-sonnet": {
    provider: "openrouter",
    name: "Claude 3.7 Sonnet (OpenRouter)",
    description: "通过OpenRouter访问的Claude 3.7 Sonnet",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "openrouter/anthropic/claude-sonnet-4": {
    provider: "openrouter",
    name: "Claude Sonnet 4 (OpenRouter)",
    description: "通过OpenRouter访问的Claude Sonnet 4",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "openrouter/openai/gpt-4.1": {
    provider: "openrouter",
    name: "GPT-4.1 (OpenRouter)",
    description: "通过OpenRouter访问的GPT-4.1",
    categories: ["general"] as ModelCategory[],
  },
  "openrouter/openai/gpt-4o": {
    provider: "openrouter",
    name: "GPT-4o (OpenRouter)",
    description: "通过OpenRouter访问的GPT-4o",
    categories: ["general"] as ModelCategory[],
  },

  // OhMyGPT 模型
  "ohmygpt/gemini-2.5-pro-preview-06-05": {
    provider: "ohmygpt",
    name: "Gemini 2.5 Pro Preview (OhMyGPT)",
    description: "通过OhMyGPT访问的Gemini 2.5 Pro Preview",
    categories: ["general"] as ModelCategory[],
  },
  "ohmygpt/gemini-2.5-flash-preview-05-20": {
    provider: "ohmygpt",
    name: "Gemini 2.5 Flash Preview (OhMyGPT)",
    description: "通过OhMyGPT访问的Gemini 2.5 Flash Preview",
    categories: ["general"] as ModelCategory[],
  },

  // MoonshotAI 模型
  "moonshotai/kimi-k2-0905-preview": {
    provider: "moonshotai",
    name: "Kimi K2 0905 Preview",
    description: "通过MoonshotAI访问的Kimi K2 0905 Preview",
    categories: ["chat", "general"] as ModelCategory[],
  },
  "moonshotai/kimi-k2-thinking-turbo": {
    provider: "moonshotai",
    name: "Kimi K2 Thinking Turbo",
    description: "通过MoonshotAI访问的Kimi K2 Thinking Turbo",
    categories: ["chat", "general"] as ModelCategory[],
  },

  // DeepSeek 模型
  "deepseek/deepseek-chat": {
    provider: "deepseek",
    name: "DeepSeek Chat",
    description: "通过DeepSeek访问的DeepSeek Chat",
    categories: ["chat", "general"] as ModelCategory[],
  },
} as const;

// 模型ID类型
export type ModelId = keyof typeof MODEL_DICTIONARY;

export type ModelConfig = {
  chatModel?: ModelId;
  classifyModel?: ModelId;
  replyModel?: ModelId;
  providerConfigs?: Record<string, ProviderConfig>;
};

// 模型提供商配置
export interface ProviderConfig {
  name: string;
  baseURL: string;
  description: string;
}

// 默认Provider配置
export const DEFAULT_PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  anthropic: {
    name: "Anthropic",
    baseURL: "https://c-z0-api-01.hash070.com/v1",
    description: "Anthropic Claude 模型",
  },
  openai: {
    name: "OpenAI",
    baseURL: "https://c-z0-api-01.hash070.com/v1",
    description: "OpenAI GPT 模型",
  },
  openrouter: {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    description: "OpenRouter 统一接口",
  },
  ohmygpt: {
    name: "OhMyGPT",
    baseURL: "https://c-z0-api-01.hash070.com/v1",
    description: "OhMyGPT 统一接口",
  },
  moonshotai: {
    name: "MoonshotAI",
    baseURL: "https://api.moonshot.cn/v1",
    description: "MoonshotAI 统一接口",
  },
  deepseek: {
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    description: "DeepSeek 统一接口",
  },
  qwen: {
    name: "Qwen",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    description: "阿里云通义千问",
  },
  google: {
    name: "Google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta", // Google 使用默认配置
    description: "Google Gemini 模型",
  },
};

// 获取聊天模型列表（支持chat类别的模型）
export function getChatModels(): ModelId[] {
  return Object.keys(MODEL_DICTIONARY).filter(modelId =>
    MODEL_DICTIONARY[modelId as ModelId].categories.includes("chat")
  ) as ModelId[];
}

// 获取通用模型列表（支持general类别的模型）
export function getGeneralModels(): ModelId[] {
  return Object.keys(MODEL_DICTIONARY).filter(modelId =>
    MODEL_DICTIONARY[modelId as ModelId].categories.includes("general")
  ) as ModelId[];
}

// 获取所有模型列表
export function getAllModels(): ModelId[] {
  return Object.keys(MODEL_DICTIONARY) as ModelId[];
}

// 根据提供商获取模型
export function getModelsByProvider(provider: string): ModelId[] {
  return Object.keys(MODEL_DICTIONARY).filter(
    modelId => MODEL_DICTIONARY[modelId as ModelId].provider === provider
  ) as ModelId[];
}

// 根据类别获取模型（支持多类别查询）
export function getModelsByCategory(category: ModelCategory): ModelId[] {
  return Object.keys(MODEL_DICTIONARY).filter(modelId =>
    MODEL_DICTIONARY[modelId as ModelId].categories.includes(category)
  ) as ModelId[];
}

// 检查模型是否支持特定类别
export function modelSupportsCategory(modelId: ModelId, category: ModelCategory): boolean {
  return MODEL_DICTIONARY[modelId].categories.includes(category);
}

// 获取模型支持的所有类别
export function getModelCategories(modelId: ModelId): ModelCategory[] {
  return [...MODEL_DICTIONARY[modelId].categories];
}

// 默认配置
export const DEFAULT_MODEL_CONFIG = {
  chatModel: "anthropic/claude-haiku-4-5" as ModelId,
  classifyModel: "openai/gpt-5-mini" as ModelId,
  replyModel: "openai/gpt-5-chat-latest" as ModelId,
} as const;

// ========== Open API 对外开放模型 ==========

/**
 * 获取对外开放的模型列表
 * 用于 GET /api/v1/models 接口
 *
 * 注意：对外开放所有内部支持的模型，保持内外一致性
 */
export function getOpenApiModels(): Array<{
  id: ModelId;
  name: string;
  categories: ModelCategory[];
}> {
  return Object.entries(MODEL_DICTIONARY).map(([modelId, modelInfo]) => ({
    id: modelId as ModelId,
    name: modelInfo.name,
    categories: [...modelInfo.categories], // 创建副本避免引用问题
  }));
}
