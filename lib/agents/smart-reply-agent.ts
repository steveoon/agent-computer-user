/**
 * Smart Reply Pipeline — 薄适配层
 *
 * 核心逻辑委托给 @roll-agent/smart-reply-agent/pipeline，
 * 本文件仅负责：
 * 1. 保持对外接口 (SmartReplyAgentOptions / SmartReplyAgentResult) 不变
 * 2. 补回 classification 兼容字段（旧消费方依赖）
 */

import {
  generateSmartReply as pipelineGenerateSmartReply,
  type SmartReplyAgentOptions as PipelineOptions,
  type SmartReplyAgentResult as PipelineResult,
  type SmartReplyDebugInfo as PipelineDebugInfo,
} from "@roll-agent/smart-reply-agent/pipeline";
import { DEFAULT_MODEL_CONFIG as HOST_DEFAULT_MODEL_CONFIG } from "@/lib/config/models";
import type { MessageClassification } from "@/types/zhipin";
import type { ReplyPolicyConfig, BrandPriorityStrategy } from "@/types/config";
import type { CandidateInfo } from "@/lib/tools/zhipin/types";
import { stageToLegacyReplyType } from "./types";

// ========== 对外接口类型（保持不变） ==========

export interface SmartReplyAgentOptions {
  modelConfig?: PipelineOptions["modelConfig"];
  preferredBrand?: string;
  toolBrand?: string;
  brandPriorityStrategy?: BrandPriorityStrategy;
  conversationHistory?: string[];
  candidateMessage: string;
  configData: PipelineOptions["configData"];
  replyPolicy?: ReplyPolicyConfig;
  candidateInfo?: CandidateInfo;
  defaultWechatId?: string;
  industryVoiceId?: string;
  channelType?: PipelineOptions["channelType"];
  turnIndex?: PipelineOptions["turnIndex"];
}

export type SmartReplyDebugInfo = PipelineDebugInfo & {
  classification: MessageClassification;
};

export type SmartReplyAgentResult = PipelineResult & {
  /**
   * 兼容字段，从 turnPlan 映射而来。
   * 运行时主路径不依赖该字段。
   */
  classification: MessageClassification;
  debugInfo?: SmartReplyDebugInfo;
};

// ========== 内部工具函数 ==========

function toClassification(turnPlan: PipelineResult["turnPlan"]): MessageClassification {
  return {
    replyType: stageToLegacyReplyType(turnPlan.stage),
    extractedInfo: {
      mentionedBrand: turnPlan.extractedInfo.mentionedBrand ?? null,
      city: turnPlan.extractedInfo.city ?? null,
      mentionedLocations: turnPlan.extractedInfo.mentionedLocations ?? null,
      mentionedDistricts: turnPlan.extractedInfo.mentionedDistricts ?? null,
      specificAge: turnPlan.extractedInfo.specificAge ?? null,
      hasUrgency: turnPlan.extractedInfo.hasUrgency ?? null,
      preferredSchedule: turnPlan.extractedInfo.preferredSchedule ?? null,
    },
    reasoningText: turnPlan.reasoningText,
  };
}

function adaptDebugInfo(
  pipelineDebug: PipelineDebugInfo | undefined,
  classification: MessageClassification
): SmartReplyDebugInfo | undefined {
  if (!pipelineDebug) return undefined;
  return {
    ...pipelineDebug,
    classification,
  };
}

// ========== 模型配置适配 ==========

/**
 * npm 包运行时实际注册的 provider 前缀。
 * 只要 provider 已注册，就允许模型 ID 直接透传。
 */
const PIPELINE_PROVIDERS = new Set([
  "anthropic", "openai", "ohmygpt", "moonshotai", "deepseek", "google", "qwen",
]);

/**
 * 仅保留人工确认过的 openrouter -> 直连模型映射。
 * 这类映射是“止血别名”，不是通用能力协商。
 */
const MODEL_ID_FALLBACK: Record<string, string> = {
  "openrouter/qwen/qwen3-235b-a22b": "qwen/qwen-max-latest",
  "openrouter/qwen/qwen-max": "qwen/qwen-max-latest",
  "openrouter/moonshotai/kimi-k2-0905": "moonshotai/kimi-k2.5",
  "openrouter/anthropic/claude-3.7-sonnet": "anthropic/claude-sonnet-4-6",
  "openrouter/anthropic/claude-sonnet-4": "anthropic/claude-sonnet-4-6",
  "openrouter/openai/gpt-4.1": "openai/gpt-5.1",
  "openrouter/openai/gpt-4o": "openai/gpt-5.1",
};

type SmartReplyModelRole = "chat" | "classify" | "reply";

function getDefaultModelForRole(role: SmartReplyModelRole): string {
  switch (role) {
    case "chat":
      return HOST_DEFAULT_MODEL_CONFIG.chatModel;
    case "classify":
      return HOST_DEFAULT_MODEL_CONFIG.classifyModel;
    case "reply":
      return HOST_DEFAULT_MODEL_CONFIG.replyModel;
  }
}

function resolveModelId(
  modelId: string | undefined,
  role: SmartReplyModelRole
): string | undefined {
  if (!modelId) return undefined;

  if (MODEL_ID_FALLBACK[modelId]) {
    const fallback = MODEL_ID_FALLBACK[modelId];
    console.warn(
      `[smart-reply-adapter] 模型 ${modelId} 降级为 ${fallback}`
    );
    return fallback;
  }

  const [provider] = modelId.split("/");

  // 已注册 provider：直接透传，避免因为字典不一致而静默换模
  if (PIPELINE_PROVIDERS.has(provider)) return modelId;

  const fallback = getDefaultModelForRole(role);

  console.warn(
    `[smart-reply-adapter] provider ${provider} 未被 npm 包注册，模型 ${modelId} 回退为 ${fallback}`
  );
  return fallback;
}

function normalizeSmartReplyModelConfig(
  modelConfig: SmartReplyAgentOptions["modelConfig"]
): PipelineOptions["modelConfig"] {
  const effectiveModelConfig = {
    ...modelConfig,
    chatModel: modelConfig?.chatModel ?? HOST_DEFAULT_MODEL_CONFIG.chatModel,
    classifyModel: modelConfig?.classifyModel ?? HOST_DEFAULT_MODEL_CONFIG.classifyModel,
    replyModel: modelConfig?.replyModel ?? HOST_DEFAULT_MODEL_CONFIG.replyModel,
  };

  return {
    ...effectiveModelConfig,
    chatModel: resolveModelId(effectiveModelConfig.chatModel, "chat"),
    classifyModel: resolveModelId(effectiveModelConfig.classifyModel, "classify"),
    replyModel: resolveModelId(effectiveModelConfig.replyModel, "reply"),
  };
}

// ========== 公开 API ==========

export async function generateSmartReply(
  options: SmartReplyAgentOptions
): Promise<SmartReplyAgentResult> {
  const normalizedOptions = {
    ...options,
    modelConfig: normalizeSmartReplyModelConfig(options.modelConfig),
  };
  const pipelineResult: PipelineResult = await pipelineGenerateSmartReply(normalizedOptions);

  const classification = toClassification(pipelineResult.turnPlan);

  return {
    ...pipelineResult,
    classification,
    debugInfo: adaptDebugInfo(pipelineResult.debugInfo, classification),
  };
}
