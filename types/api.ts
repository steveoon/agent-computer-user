/**
 * API 相关类型定义
 * 统一管理所有 API 接口的请求和响应类型
 */

import { z } from "zod";
import type { UIMessage } from "ai";
import type { ModelConfig } from "@/lib/config/models";
import type { ZhipinData, SystemPromptsConfig, ReplyPromptsConfig } from "./index";
import type { OpenApiPromptType } from "@/lib/tools/tool-registry";

// ========== Chat API 相关类型 ==========

/**
 * Chat API 请求体 Schema
 * 用于 POST /api/chat 接口
 *
 * 注意：sandboxId 是可选的
 * - 当需要使用 computerTool 等沙盒工具时，必须提供有效的 sandboxId
 * - 对于纯文本对话或不需要沙盒的工具，可以不提供或设为 null
 */
export const ChatRequestBodySchema = z.object({
  // 必需字段
  messages: z.array(z.unknown()), // UIMessage[] - Zod 无法验证复杂的 AI SDK 类型
  sandboxId: z.string().nullable(), // null 表示不使用沙盒

  // 可选字段
  preferredBrand: z.string().optional(),
  modelConfig: z.unknown().optional(), // ModelConfig - 来自 lib/config/models
  configData: z.unknown().optional(), // ZhipinData
  systemPrompts: z.unknown().optional(), // SystemPromptsConfig
  replyPrompts: z.unknown().optional(), // ReplyPromptsConfig
  activeSystemPrompt: z.string().optional(), // keyof SystemPromptsConfig
  dulidayToken: z.string().optional(),
  defaultWechatId: z.string().optional(), // 默认微信号
});

/**
 * Chat API 请求体类型
 * 严格类型定义，用于前后端类型一致性
 */
export interface ChatRequestBody {
  // 必需字段
  messages: UIMessage[];
  sandboxId: string | null; // null 表示不需要沙盒功能

  // 可选字段
  preferredBrand?: string;
  modelConfig?: ModelConfig;
  configData?: ZhipinData;
  systemPrompts?: SystemPromptsConfig;
  replyPrompts?: ReplyPromptsConfig;
  activeSystemPrompt?: keyof SystemPromptsConfig;
  dulidayToken?: string;
  defaultWechatId?: string; // 默认微信号
}

/**
 * 用于前端组件的简化请求体类型
 * 不包含 messages 字段（由 useChat 内部管理）
 */
export type ChatRequestOptions = Omit<ChatRequestBody, "messages">;

// ========== Sync API 相关类型 ==========

/**
 * Sync API 请求体类型
 * 用于 POST /api/sync 接口
 */
export interface SyncRequestBody {
  organizationIds: number[];
  pageSize?: number;
  validateOnly?: boolean;
  token?: string;
}

/**
 * Sync API 响应体类型
 */
export interface SyncResponseBody {
  success: boolean;
  message?: string;
  data?: {
    brandData?: ZhipinData;
    organizationName?: string;
    updatedAt?: string;
  };
  error?: string;
}

// ========== Test LLM Reply API 相关类型 ==========

/**
 * Test LLM Reply API 请求体类型
 * 用于 POST /api/test-llm-reply 接口
 */
export interface TestLLMReplyRequestBody {
  message: string;
  brand: string;
  conversationHistory?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  modelConfig?: ModelConfig;
  configData?: ZhipinData;
  replyPrompts?: ReplyPromptsConfig;
}

/**
 * Test LLM Reply API 响应体类型
 */
export interface TestLLMReplyResponseBody {
  success: boolean;
  data?: {
    scenario: string;
    smartReply: string;
    extractedInfo?: Record<string, unknown>;
    debug?: {
      classificationTime?: number;
      replyTime?: number;
      totalTime?: number;
    };
  };
  error?: string;
}

// ========== 通用响应类型 ==========

/**
 * 通用 API 错误响应
 */
export interface APIErrorResponse {
  error: string;
  message?: string;
  details?: unknown;
  statusCode?: number;
  correlationId?: string;
}

/**
 * 通用 API 成功响应
 */
export interface APISuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

// ========== 类型守卫 ==========

/**
 * 检查是否为有效的 ChatRequestBody
 */
export function isChatRequestBody(value: unknown): value is ChatRequestBody {
  return ChatRequestBodySchema.safeParse(value).success;
}

/**
 * 验证并解析 ChatRequestBody
 */
export function validateChatRequestBody(value: unknown): ChatRequestBody {
  const result = ChatRequestBodySchema.parse(value);
  return result as ChatRequestBody;
}

// ========== Models API 相关类型 ==========

/**
 * 模型信息类型
 * 用于 GET /api/v1/models 接口
 */
export interface ModelInfo {
  id: string;
  name: string;
  categories: string[];
}

/**
 * Models API 响应体类型
 */
export interface ModelsResponseBody {
  models: ModelInfo[];
}

// ========== Open Chat API 相关类型 ==========

/**
 * 上下文策略类型
 * 定义当工具缺少必需上下文时的处理方式
 */
export type ContextStrategy = "error" | "skip" | "report";

/**
 * 消息剪裁选项
 */
export interface PruneOptions {
  maxOutputTokens?: number;
  targetTokens?: number;
  preserveRecentMessages?: number;
}

/**
 * 工具特定上下文映射
 * 键为工具名，值为该工具的上下文覆盖
 */
export type ToolContextMap = Record<string, Record<string, unknown>>;

/**
 * Open Chat API 请求体 Schema
 * 用于 POST /api/v1/chat 接口
 */
export const OpenChatRequestSchema = z.object({
  // 必需字段
  model: z.string().describe("模型ID，格式：provider/model"),
  messages: z.array(z.unknown()).describe("消息数组，支持 {role, content} 或 UIMessage 格式"),

  // 流式控制
  stream: z.boolean().optional().default(true).describe("是否流式输出"),

  // 消息剪裁
  prune: z.boolean().optional().default(false).describe("是否启用消息剪裁"),
  pruneOptions: z
    .object({
      maxOutputTokens: z.number().optional(),
      targetTokens: z.number().optional(),
      preserveRecentMessages: z.number().optional(),
    })
    .optional()
    .describe("消息剪裁选项"),

  // 系统提示词
  systemPrompt: z.string().optional().describe("直接指定系统提示词，优先级高于 promptType"),
  promptType: z
    .enum(["bossZhipinSystemPrompt", "bossZhipinLocalSystemPrompt", "generalComputerSystemPrompt"])
    .optional()
    .describe(
      `系统提示词类型，从 context.systemPrompts 中查找。可选值: bossZhipinSystemPrompt, bossZhipinLocalSystemPrompt, generalComputerSystemPrompt`
    ),

  // 工具控制
  allowedTools: z.array(z.string()).optional().describe("允许使用的工具名称列表"),
  toolContext: z.record(z.string(), z.unknown()).optional().describe("工具特定上下文"),
  contextStrategy: z
    .enum(["error", "skip", "report"])
    .optional()
    .default("error")
    .describe("上下文缺失处理策略"),

  // 沙盒
  sandboxId: z.string().nullable().optional().describe("E2B 沙盒ID"),

  // 通用上下文
  context: z
    .object({
      preferredBrand: z.string().optional(),
      modelConfig: z.unknown().optional(),
      configData: z.unknown().optional(),
      systemPrompts: z.record(z.string(), z.string()).optional().describe("系统提示词映射"),
      replyPrompts: z.unknown().optional(),
      dulidayToken: z.string().optional(),
      defaultWechatId: z.string().optional(),
    })
    .optional()
    .describe("全局上下文"),

  // 验证模式
  validateOnly: z.boolean().optional().default(false).describe("仅验证，不执行"),
});

/**
 * Open Chat API 请求体类型
 * 遵循 AI SDK 消息格式规范
 */
export interface OpenChatRequest {
  // 必需字段
  model: string;

  /**
   * 消息数组
   * 支持两种格式：
   * 1. AI SDK 标准格式：UIMessage (推荐)
   * 2. 简化格式：{role, content} (将在服务端归一化为 UIMessage)
   */
  messages: UIMessage[] | Array<{ role: string; content: string }>;

  // 流式控制
  stream?: boolean;

  // 消息剪裁
  prune?: boolean;
  pruneOptions?: PruneOptions;

  // 系统提示词
  systemPrompt?: string;
  promptType?: OpenApiPromptType;

  // 工具控制
  allowedTools?: string[];
  toolContext?: ToolContextMap;
  contextStrategy?: ContextStrategy;

  // 沙盒
  sandboxId?: string | null;

  // 通用上下文
  context?: {
    preferredBrand?: string;
    modelConfig?: ModelConfig;
    configData?: ZhipinData;
    systemPrompts?: Record<string, string>;
    replyPrompts?: ReplyPromptsConfig;
    dulidayToken?: string;
    defaultWechatId?: string;
  };

  // 验证模式
  validateOnly?: boolean;
}

/**
 * Open Chat API 非流式响应体
 * 遵循 AI SDK 的类型规范
 */
export interface OpenChatResponse {
  /**
   * 生成的消息数组
   * 使用 AI SDK 的 UIMessage 类型
   */
  messages: UIMessage[];

  /**
   * Token 使用情况
   * 严格遵循 AI SDK LanguageModelUsage 的字段命名
   *
   * 注意：AI SDK 使用 inputTokens/outputTokens，而非 promptTokens/completionTokens
   * 所有字段都是可选的（undefined 表示提供商未报告该值）
   *
   * @see https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text
   */
  usage: {
    /** 输入（提示）token 数量 */
    inputTokens?: number;
    /** 输出（生成）token 数量 */
    outputTokens?: number;
    /** 总 token 数量（可能不等于 input + output，因为可能包含开销） */
    totalTokens?: number;
    /** 推理 token 数量（仅某些模型支持） */
    reasoningTokens?: number;
    /** 缓存的输入 token 数量（仅某些提供商支持） */
    cachedInputTokens?: number;
  };

  /**
   * 工具使用信息
   */
  tools: {
    used: string[];
    skipped: string[];
  };
}

/**
 * 验证报告类型
 * 用于 validateOnly=true 或 contextStrategy=report
 */
export interface ValidationReport {
  valid: boolean;
  model: {
    valid: boolean;
    error?: string;
  };
  tools: Array<{
    name: string;
    valid: boolean;
    missingContext?: string[];
    error?: string;
  }>;
}

/**
 * 检查是否为有效的 OpenChatRequest
 */
export function isOpenChatRequest(value: unknown): value is OpenChatRequest {
  return OpenChatRequestSchema.safeParse(value).success;
}

/**
 * 验证并解析 OpenChatRequest
 */
export function validateOpenChatRequest(value: unknown): OpenChatRequest {
  const result = OpenChatRequestSchema.parse(value);
  return result as OpenChatRequest;
}
