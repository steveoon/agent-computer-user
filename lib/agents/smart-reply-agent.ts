/**
 * Smart Reply Pipeline (Policy-First)
 *
 * 回合规划 → needs 驱动上下文构建 → 策略化回复生成 → FactGate 校验
 */

import { getDynamicRegistry } from "@/lib/model-registry/dynamic-registry";
import { DEFAULT_MODEL_CONFIG, DEFAULT_PROVIDER_CONFIGS, type ModelId } from "@/lib/config/models";
import { type ZhipinData, type MessageClassification } from "@/types/zhipin";
import type { ReplyPolicyConfig, BrandPriorityStrategy } from "@/types/config";
import type { CandidateInfo } from "@/lib/tools/zhipin/types";
import type { StoreWithDistance } from "@/types/geocoding";
import type { TurnPlan, ReplyNeed, FunnelStage } from "@/types/reply-policy";
import { stageToLegacyReplyType, type ProviderConfigs } from "./types";
import { planTurn } from "./classification-agent";
import { buildContextInfoByNeeds } from "@/lib/loaders/zhipin-data.loader";
import { safeGenerateText, type SafeGenerateTextUsage } from "@/lib/ai";
import { logError, type AppError } from "@/lib/errors";
import {
  evaluateAgeEligibility,
  type AgeEligibilityAppliedStrategy,
  type AgeEligibilityResult,
  type AgeEligibilityStatus,
  type AgeEligibilitySummary,
} from "@/lib/services/eligibility/age-eligibility";

export interface SmartReplyAgentOptions {
  modelConfig?: {
    chatModel?: string;
    classifyModel?: string;
    replyModel?: string;
    providerConfigs?: ProviderConfigs;
  };
  preferredBrand?: string;
  toolBrand?: string;
  brandPriorityStrategy?: BrandPriorityStrategy;
  conversationHistory?: string[];
  candidateMessage: string;
  configData: ZhipinData;
  replyPolicy?: ReplyPolicyConfig;
  candidateInfo?: CandidateInfo;
  defaultWechatId?: string;
  industryVoiceId?: string;
}

export interface SmartReplyDebugInfo {
  relevantStores: StoreWithDistance[];
  storeCount: number;
  detailLevel: string;
  turnPlan: TurnPlan;
  classification: MessageClassification;
  gateStatus: AgeEligibilityStatus;
  appliedStrategy: AgeEligibilityAppliedStrategy;
  ageRangeSummary: AgeEligibilitySummary;
}

export interface SmartReplyAgentResult {
  turnPlan: TurnPlan;
  /**
   * 兼容字段，避免外围旧逻辑立即崩溃。
   * 运行时主路径不依赖该字段。
   */
  classification: MessageClassification;
  suggestedReply: string;
  confidence: number;
  shouldExchangeWechat?: boolean;
  contextInfo?: string;
  debugInfo?: SmartReplyDebugInfo;
  usage?: SafeGenerateTextUsage;
  latencyMs?: number;
  error?: AppError;
}


function toClassification(turnPlan: TurnPlan): MessageClassification {
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

function resolveCandidateAge(turnPlan: TurnPlan, candidateInfo?: CandidateInfo): number | undefined {
  if (typeof candidateInfo?.age === "number") {
    return candidateInfo.age;
  }
  if (typeof turnPlan.extractedInfo.specificAge === "number") {
    return turnPlan.extractedInfo.specificAge;
  }
  return undefined;
}

function resolveRegionName(turnPlan: TurnPlan, candidateInfo?: CandidateInfo): string | undefined {
  const district = turnPlan.extractedInfo.mentionedDistricts?.[0]?.district;
  if (district) return district;
  const location = turnPlan.extractedInfo.mentionedLocations?.[0]?.location;
  if (location) return location;
  if (candidateInfo?.jobAddress) return candidateInfo.jobAddress;
  return undefined;
}

function formatAgeRange(summary: AgeEligibilitySummary): string | null {
  if (summary.minAgeObserved === null && summary.maxAgeObserved === null) return null;
  const min = summary.minAgeObserved ?? "?";
  const max = summary.maxAgeObserved ?? "?";
  return `${min}-${max}`;
}

function buildAgeQualificationConstraints(
  eligibility: AgeEligibilityResult | undefined,
  policy: ReplyPolicyConfig | undefined
): string[] {
  const agePolicy = policy?.qualificationPolicy?.age;
  if (!eligibility || !agePolicy || !agePolicy.enabled) {
    return [];
  }

  const lines: string[] = ["[QualificationPolicy:Age]"];
  const rangeText = formatAgeRange(eligibility.summary);

  lines.push(`- gateStatus: ${eligibility.status}`);
  lines.push(`- expressionStrategy: ${eligibility.appliedStrategy.strategy}`);
  lines.push(
    `- redirect: ${agePolicy.allowRedirect ? `allowed priority=${agePolicy.redirectPriority}` : "not allowed"}`
  );
  lines.push(`- revealRange: ${agePolicy.revealRange ? "allowed" : "not allowed"}`);
  if (agePolicy.revealRange && rangeText) {
    lines.push(`- rangeObserved: ${rangeText}`);
  }

  if (eligibility.status === "pass") {
    lines.push(
      `- writingConstraint: ${eligibility.appliedStrategy.strategy}；匹配通过后推进下一步，避免强调年龄筛选`
    );
  } else if (eligibility.status === "fail") {
    lines.push(
      `- writingConstraint: ${eligibility.appliedStrategy.strategy}；礼貌说明不匹配，避免承诺或争辩`
    );
    if (agePolicy.allowRedirect) {
      lines.push("- writingConstraint: 可提示其他岗位或门店选项");
    }
  } else {
    lines.push(
      `- writingConstraint: ${eligibility.appliedStrategy.strategy}；先核实年龄或关键资格信息，再给出结论`
    );
  }

  return lines;
}

function buildPolicyPrompt(
  policy: ReplyPolicyConfig | undefined,
  turnPlan: TurnPlan,
  contextInfo: string,
  message: string,
  conversationHistory: string[],
  industryVoiceId?: string,
  defaultWechatId?: string,
  ageEligibility?: AgeEligibilityResult
): { system: string; prompt: string } {
  if (!policy) {
    return {
      system: "你是招聘助手。遵循事实，不夸大承诺，回复简洁自然。",
      prompt: `候选人消息：${message}\n\n上下文：\n${contextInfo}\n\n请直接回复候选人。`,
    };
  }

  const stagePolicy = policy.stageGoals[turnPlan.stage];
  const voice = policy.industryVoices[industryVoiceId || policy.defaultIndustryVoiceId];

  const system = [
    "你是政策驱动的招聘助手。",
    `当前阶段：${turnPlan.stage}`,
    `阶段目标：${stagePolicy.primaryGoal}`,
    `阶段成功标准：${stagePolicy.successCriteria.join("；")}`,
    `推进策略：${stagePolicy.ctaStrategy}`,
    stagePolicy.disallowedActions?.length
      ? `阶段禁止：${stagePolicy.disallowedActions.join("；")}`
      : "",
    `人格设定：语气=${policy.persona.tone}，亲和度=${policy.persona.warmth}，长度=${policy.persona.length}，称呼=${policy.persona.addressStyle}`,
    `共情策略：${policy.persona.empathyStrategy}`,
    voice
      ? `行业指纹：${voice.name}；背景=${voice.industryBackground}；行业词=${voice.jargon.join("、")}；避免=${voice.tabooPhrases.join("、")}`
      : "",
    `红线规则：${policy.hardConstraints.rules.map(rule => rule.rule).join("；")}`,
    `FactGate模式：${policy.factGate.mode}；缺事实回退=${policy.factGate.fallbackBehavior}`,
    ...buildAgeQualificationConstraints(ageEligibility, policy),
    defaultWechatId
      ? `如涉及换微信，优先引导平台交换，必要时可提供默认微信号：${defaultWechatId}`
      : "如涉及换微信，优先引导平台交换，不编造联系方式。",
    "必须口语化、简洁，不输出解释。",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    `[回合规划]`,
    `stage=${turnPlan.stage}`,
    `subGoals=${turnPlan.subGoals.join("、") || "无"}`,
    `needs=${turnPlan.needs.join("、") || "none"}`,
    `riskFlags=${turnPlan.riskFlags.join("、") || "无"}`,
    `confidence=${turnPlan.confidence.toFixed(2)}`,
    "",
    `[对话历史]`,
    conversationHistory.slice(-6).join("\n") || "无",
    "",
    `[业务上下文]`,
    contextInfo,
    "",
    `[候选人消息]`,
    message,
    "",
    `[输出要求]`,
    "1. 直接给候选人的单条回复。",
    "2. 不得输出多段解释或元信息。",
    "3. 允许主动推进下一步，但不得越过红线。",
  ].join("\n");

  return { system, prompt };
}

function hasFactClaims(text: string): boolean {
  const claimPattern =
    /(\d+\s*元|\d+\s*小时|\d+\s*分钟|\d+\s*家店|\d+\s*家门店|具体地址|地址在|门店在|位置在|位于|附近|旁边|地铁\S+站|五险一金|社保|可约\S|名额\s*\d)/i;
  return claimPattern.test(text);
}

function needsFacts(needs: ReplyNeed[]): boolean {
  return needs.some(need =>
    ["stores", "location", "salary", "schedule", "policy", "availability", "requirements"].includes(
      need
    )
  );
}

function hasFactsInContext(contextInfo: string): boolean {
  return /(匹配到的门店信息|职位：|薪资：|排班：|可用时段：|出勤要求：)/.test(contextInfo);
}

function shouldExchangeWechatByStage(stage: FunnelStage): boolean {
  return stage === "private_channel" || stage === "interview_scheduling";
}

async function rewriteForFactGate(
  text: string,
  model: ReturnType<ReturnType<typeof getDynamicRegistry>["languageModel"]>,
  contextInfo: string
): Promise<{ text: string; usage?: SafeGenerateTextUsage; latencyMs?: number }> {
  const rewritePrompt = [
    "请重写下面这条招聘回复。",
    "要求：",
    "- 不新增任何具体数字、地址、福利承诺。",
    "- 仅保留泛化表达，强调可进一步沟通确认细节。",
    "- 口语化、单行、简洁。",
    "",
    "[原回复]",
    text,
    "",
    "[可用上下文]",
    contextInfo,
  ].join("\n");

  const rewritten = await safeGenerateText({
    model,
    prompt: rewritePrompt,
    context: "SmartReplyFactGateRewrite",
    timeoutMs: 20_000,
    maxOutputTokens: 500,
  });

  if (!rewritten.success) {
    return { text };
  }

  return {
    text: rewritten.text,
    usage: rewritten.usage,
    latencyMs: rewritten.latencyMs,
  };
}

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
    replyPolicy,
    candidateInfo,
    defaultWechatId,
    industryVoiceId,
  } = options;

  const providerConfigs = modelConfig?.providerConfigs || DEFAULT_PROVIDER_CONFIGS;
  const brandData = {
    city: configData.city,
    defaultBrand: configData.defaultBrand || Object.keys(configData.brands)[0] || "",
    availableBrands: Object.keys(configData.brands),
    storeCount: configData.stores.length,
  };

  const turnPlan = await planTurn(candidateMessage, {
    modelConfig: modelConfig || {},
    conversationHistory,
    brandData,
    providerConfigs,
  });

  const classification = toClassification(turnPlan);

  const { contextInfo, debugInfo, resolvedBrand } = await buildContextInfoByNeeds(
    configData,
    turnPlan,
    preferredBrand,
    toolBrand,
    brandPriorityStrategy,
    candidateInfo,
    replyPolicy,
    industryVoiceId
  );

  const ageEligibility = await evaluateAgeEligibility({
    age: resolveCandidateAge(turnPlan, candidateInfo),
    brandAlias: resolvedBrand,
    cityName: turnPlan.extractedInfo.city ?? configData.city,
    regionName: resolveRegionName(turnPlan, candidateInfo),
    strategy: replyPolicy?.qualificationPolicy?.age,
  });

  const registry = getDynamicRegistry(providerConfigs);
  const replyModel = (modelConfig?.replyModel || DEFAULT_MODEL_CONFIG.replyModel) as ModelId;
  const model = registry.languageModel(replyModel);

  const prompts = buildPolicyPrompt(
    replyPolicy,
    turnPlan,
    contextInfo,
    candidateMessage,
    conversationHistory,
    industryVoiceId,
    defaultWechatId,
    ageEligibility
  );

  const replyResult = await safeGenerateText({
    model,
    system: prompts.system,
    prompt: prompts.prompt,
    context: "SmartReply",
    timeoutMs: 30_000,
    maxOutputTokens: 2000,
  });

  if (!replyResult.success) {
    logError("SmartReply 生成失败", replyResult.error);
    return {
      turnPlan,
      classification,
      suggestedReply: "",
      confidence: 0,
      shouldExchangeWechat: shouldExchangeWechatByStage(turnPlan.stage),
      contextInfo,
      debugInfo: {
        ...debugInfo,
        classification,
        gateStatus: ageEligibility.status,
        appliedStrategy: ageEligibility.appliedStrategy,
        ageRangeSummary: ageEligibility.summary,
      },
      error: replyResult.error,
    };
  }

  let finalText = replyResult.text;
  let finalUsage = replyResult.usage;
  let finalLatencyMs = replyResult.latencyMs;

  if (replyPolicy?.factGate.mode === "strict") {
    const violation =
      hasFactClaims(finalText) &&
      !(needsFacts(turnPlan.needs) && hasFactsInContext(contextInfo));

    if (violation) {
      const rewritten = await rewriteForFactGate(finalText, model, contextInfo);
      finalText = rewritten.text;
      if (rewritten.usage) {
        finalUsage = rewritten.usage;
      }
      if (rewritten.latencyMs !== undefined) {
        finalLatencyMs = (finalLatencyMs ?? 0) + rewritten.latencyMs;
      }
    }
  }

  return {
    turnPlan,
    classification,
    suggestedReply: finalText,
    confidence: Math.max(0, Math.min(1, turnPlan.confidence)),
    shouldExchangeWechat: shouldExchangeWechatByStage(turnPlan.stage),
    contextInfo: `${contextInfo}\n当前品牌：${resolvedBrand}`,
    debugInfo: {
      ...debugInfo,
      classification,
      gateStatus: ageEligibility.status,
      appliedStrategy: ageEligibility.appliedStrategy,
      ageRangeSummary: ageEligibility.summary,
    },
    usage: finalUsage,
    latencyMs: finalLatencyMs,
  };
}
