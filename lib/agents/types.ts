/**
 * Agent 类型定义
 *
 * 集中定义所有 Agent 相关的类型和 Schema
 * 遵循 Zod Schema-First 架构
 */

import { z } from "zod/v3";
import type { ProviderConfig, ModelConfig } from "@/lib/config/models";
import type { FunnelStage } from "@/types/reply-policy";
import type { ReplyContext } from "@/types/zhipin";

// ========== 基础 Schema 定义 ==========

/**
 * Provider 配置 Schema
 */
export const ProviderConfigSchema = z.object({
  name: z.string(),
  baseURL: z.string(),
  description: z.string(),
});

/**
 * Provider 配置集合 Schema
 */
export const ProviderConfigsSchema = z.record(z.string(), ProviderConfigSchema);

/**
 * 模型配置 Schema
 */
export const ModelConfigSchema = z.object({
  chatModel: z.string().optional(),
  classifyModel: z.string().optional(),
  replyModel: z.string().optional(),
  providerConfigs: ProviderConfigsSchema.optional(),
});

// ========== Classification Agent Schema ==========

/**
 * 品牌数据 Schema（用于分类 Agent）
 */
export const BrandDataSchema = z.object({
  city: z.string(),
  defaultBrand: z.string(),
  availableBrands: z.array(z.string()),
  storeCount: z.number(),
});

/**
 * Classification Agent Call Options Schema
 * 将 10+ 函数参数统一为结构化选项
 */
export const ClassificationOptionsSchema = z.object({
  // 模型配置（从用户设置读取）
  modelConfig: ModelConfigSchema,
  // 候选人消息（用于构建分类提示）
  candidateMessage: z.string(),
  // 对话上下文
  conversationHistory: z.array(z.string()).default([]),
  // 品牌数据
  brandData: BrandDataSchema.optional(),
});

// ========== 共享工具函数 ==========

const STAGE_TO_REPLY_TYPE: Record<FunnelStage, ReplyContext> = {
  trust_building: "general_chat",
  private_channel: "followup_chat",
  qualify_candidate: "attendance_inquiry",
  job_consultation: "salary_inquiry",
  interview_scheduling: "interview_request",
  onboard_followup: "followup_chat",
};

/**
 * 将 FunnelStage 映射为旧版 ReplyContext（兼容旧路径）
 */
export function stageToLegacyReplyType(stage?: FunnelStage): ReplyContext {
  if (!stage) return "general_chat";
  return STAGE_TO_REPLY_TYPE[stage];
}

// ========== 类型导出 ==========

export type ProviderConfigs = z.infer<typeof ProviderConfigsSchema>;
export type BrandData = z.infer<typeof BrandDataSchema>;
export type ClassificationOptions = z.infer<typeof ClassificationOptionsSchema>;

// 重新导出供外部使用
export type { ProviderConfig, ModelConfig };

// ========== 事实提取引擎类型 ==========

/**
 * 用户提示词构建函数
 * 接收对话内容，返回包含字段定义和对话历史的用户侧提示词
 */
export type UserPromptBuilder = (message: string, conversationHistory: string[]) => string;

/**
 * 本地增量缓存配置
 *
 * 启用后，引擎自动实现：
 * 1. 历史事实加载（本地缓存 GET）
 * 2. 增量提取策略（有历史 → 10条，无历史 → 50条）
 * 3. 新旧事实合并（引擎内置深度合并）
 * 4. 滑动过期更新（每次写入刷新 TTL）
 */
export interface FactCacheOptions {
  /** 用户 ID，缓存键格式：candidate_facts:{userId}:{sessionId} */
  userId: string;
  /** 会话 ID */
  sessionId: string;
  /**
   * 缓存 TTL（秒），每次写入时重置（滑动过期）
   * 默认 86400（24 小时）
   */
  ttl?: number;
  /**
   * 有历史事实时，提取最近 N 条消息（增量模式）
   * 默认 10，Token 节省率 > 85%
   */
  incrementalMessages?: number;
  /**
   * 无历史事实时，提取最近 N 条消息（全量模式）
   * 默认 50，Token 节省率 > 75%
   */
  fullMessages?: number;
}

/**
 * 事实提取配置
 */
export interface FactExtractionOptions<T> {
  /** 业务场景专属 Zod Schema，定义要提取的字段结构 */
  extractionSchemaOutput: z.ZodSchema<T>;
  /** Schema 名称，用于日志和调试 */
  schemaName: string;
  /**
   * 构建用户侧提示词
   * 负责组织字段定义、领域数据（如品牌列表）和对话内容
   */
  buildUserPrompt: UserPromptBuilder;
  /** LLM 调用失败时的降级返回值 */
  fallback: T;
  /** 模型配置 */
  modelConfig?: { extractModel?: string };
  /**
   * 本地增量缓存配置（可选）
   * 启用后自动实现增量提取策略和滑动过期，返回合并后的完整事实
   * 合并规则由引擎内置：数组字段累积去重，其他字段新值覆盖（非空时）
   */
  cache?: FactCacheOptions;
}
