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
  brandData: BrandDataSchema,
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
