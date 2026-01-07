/**
 * Smart Reply Pipeline
 *
 * 智能回复生成管道，封装分类 + 回复生成的两阶段流程
 *
 * 架构说明:
 * 这是一个确定性的顺序管道，不是代理工作流：
 *   分类 → 构建上下文 → 生成回复 (generateText)
 *
 * 不使用 ToolLoopAgent，因为：
 * 1. 流程是确定的，不需要 LLM 决定调用哪个工具
 * 2. generateText 对结构化输出支持更好（自动传递 enum 约束）
 * 3. 简单的函数组合比 Agent 抽象更易于调试
 *
 * 核心价值:
 * - 职责分离: 从 zhipin-data.loader.ts 抽离
 * - 与现有系统兼容: 输出格式对齐 ZhipinReplyToolResult
 * - 保持完整业务逻辑: 品牌解析、门店排序、上下文构建
 */

import { generateText } from "ai";
import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PROVIDER_CONFIGS, type ModelId } from "@/lib/config/models";
import { ReplyPromptBuilder, type ReplyBuilderParams } from "@/lib/prompt-engineering";
import { type ZhipinData, type MessageClassification } from "@/types/zhipin";
import type { ReplyPromptsConfig, BrandPriorityStrategy } from "@/types/config";
import type { CandidateInfo } from "@/lib/tools/zhipin/types";
import type { StoreWithDistance } from "@/types/geocoding";
import { type ProviderConfigs } from "./types";
import { classifyMessage } from "./classification-agent";
// 复用原有业务逻辑
import { buildContextInfo } from "@/lib/loaders/zhipin-data.loader";

// ========== 类型定义 ==========

export interface SmartReplyAgentOptions {
  modelConfig?: {
    chatModel?: string;
    classifyModel?: string;
    replyModel?: string;
    providerConfigs?: ProviderConfigs;
  };
  /** UI 选择的品牌 */
  preferredBrand?: string;
  /** 工具调用时从职位详情识别的品牌 */
  toolBrand?: string;
  /** 品牌优先级策略 */
  brandPriorityStrategy?: BrandPriorityStrategy;
  conversationHistory?: string[];
  candidateMessage: string;
  configData: ZhipinData;
  replyPrompts?: ReplyPromptsConfig;
  candidateInfo?: CandidateInfo;
  defaultWechatId?: string;
}

/**
 * 调试信息类型（与原有 debugInfo 对齐）
 */
export interface SmartReplyDebugInfo {
  relevantStores: StoreWithDistance[];
  storeCount: number;
  detailLevel: string;
  classification: MessageClassification;
}

export interface SmartReplyAgentResult {
  classification: MessageClassification;
  suggestedReply: string;
  confidence: number;
  shouldExchangeWechat?: boolean;
  contextInfo?: string;
  /** 调试信息（门店排序、详细级别等） */
  debugInfo?: SmartReplyDebugInfo;
}

// ========== 主函数 ==========

/**
 * 执行智能回复生成
 *
 * 顺序管道：分类 → 构建上下文 → 生成回复
 *
 * @param options - 智能回复选项
 * @returns 智能回复结果
 */
export async function generateSmartReply(
  options: SmartReplyAgentOptions
): Promise<SmartReplyAgentResult> {
  const {
    modelConfig,
    preferredBrand,
    toolBrand,
    brandPriorityStrategy,
    conversationHistory = [],
    candidateMessage,
    configData,
    replyPrompts,
    candidateInfo,
    defaultWechatId,
  } = options;

  const providerConfigs = modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS;

  // Step 1: 分类
  const brandData = {
    city: configData.city,
    defaultBrand: configData.defaultBrand || Object.keys(configData.brands)[0] || "",
    availableBrands: Object.keys(configData.brands),
    storeCount: configData.stores.length,
  };

  const classification = await classifyMessage(candidateMessage, {
    modelConfig: modelConfig || {},
    conversationHistory,
    brandData,
    providerConfigs,
  });

  // Step 2: 获取回复指令
  const replyType = classification.replyType as keyof ReplyPromptsConfig;
  const systemInstruction = replyPrompts?.[replyType] || replyPrompts?.general_chat || "";

  // Step 3: 构建上下文信息（使用完整业务逻辑）
  // 包含：品牌冲突解析、门店排序、距离计算、详细级别控制、品牌专属模板
  const { contextInfo, resolvedBrand, debugInfo } = await buildContextInfo(
    configData,
    classification,
    preferredBrand, // UI 选择的品牌
    toolBrand, // 工具识别的品牌
    brandPriorityStrategy,
    candidateInfo
  );

  // Step 4: 生成回复（使用 generateText）
  const registry = getDynamicRegistry(providerConfigs);
  const replyModel = (modelConfig?.replyModel || DEFAULT_MODEL_CONFIG.replyModel) as ModelId;

  const replyBuilder = new ReplyPromptBuilder();
  const replyParams: ReplyBuilderParams = {
    message: candidateMessage,
    classification,
    contextInfo,
    systemInstruction,
    conversationHistory,
    candidateInfo,
    targetBrand: resolvedBrand, // 使用解析后的品牌，确保一致性
    defaultWechatId,
  };

  const prompts = replyBuilder.build(replyParams);

  const replyResult = await generateText({
    model: registry.languageModel(replyModel),
    system: prompts.system,
    prompt: prompts.prompt,
  });

  // Step 5: 更新内存
  replyBuilder.updateMemory(candidateMessage, replyResult.text);

  // 计算置信度
  const confidence = calculateConfidence(classification);

  // 判断是否应该交换微信
  const shouldExchangeWechat =
    classification.replyType === "interview_request" ||
    classification.replyType === "followup_chat";

  return {
    classification,
    suggestedReply: replyResult.text,
    confidence,
    shouldExchangeWechat,
    contextInfo,
    debugInfo, // 包含门店排序、详细级别等调试信息
  };
}

// ========== 辅助函数 ==========

/**
 * 计算分类置信度
 */
function calculateConfidence(classification: MessageClassification): number {
  // 基于提取信息的丰富度计算置信度
  const extractedInfo = classification.extractedInfo;
  let score = 0.5; // 基础分

  if (extractedInfo.mentionedBrand) score += 0.1;
  if (extractedInfo.city) score += 0.1;
  if (extractedInfo.mentionedLocations?.length) score += 0.1;
  if (extractedInfo.mentionedDistricts?.length) score += 0.1;
  if (classification.reasoningText.length > 50) score += 0.1;

  return Math.min(score, 1);
}
