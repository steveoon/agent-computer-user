/**
 * API 相关类型定义
 * 统一管理所有 API 接口的请求和响应类型
 */

import { z } from "zod";
import { UIMessage } from "ai";
import type { ModelConfig } from "@/lib/config/models";
import type { ZhipinData, SystemPromptsConfig, ReplyPromptsConfig } from "./index";

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
