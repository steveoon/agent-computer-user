/**
 * classify_intent 工具
 *
 * 企微智能回复场景专用工具，负责：
 * - 识别对话阶段（stage）
 * - 检测回复需求（needs）
 * - 标记风险因子（riskFlags）
 * - 提取候选人事实信息（interview_info + preferences）
 *
 * 架构特性：
 * - 双任务并行：阶段规划 + 实体提取同时进行
 * - 配置驱动：阶段目标从运营后台动态注入
 * - 结构化输出：基于 Zod Schema 的类型安全
 * - Policy-First：规则层 + LLM 层双重保障
 */

import { tool } from "ai";
import { z } from "zod/v3";
import { planTurn } from "@/lib/agents/classification-agent";
import {
  extractCandidateFacts,
  fetchBrandData,
} from "@/lib/agents/wework-entity-extraction-agent";
import {
  FunnelStageSchema,
  ReplyNeedSchema,
  RiskFlagSchema,
  StageGoalPolicySchema,
} from "@/types/reply-policy";
import { InterviewInfoSchema, PreferencesSchema } from "@/lib/agents/types";
import { ErrorCode, createConfigError } from "@/lib/errors";

// ========== 输入参数 Schema ==========

const ClassifyIntentInputSchema = z.object({
  message: z.string().describe("候选人当前消息"),
  conversationHistory: z
    .array(z.string())
    .default([])
    .describe("对话历史（最近 10 轮）"),
  stageGoals: z
    .record(FunnelStageSchema, StageGoalPolicySchema)
    .describe("阶段目标配置（从运营后台传入）"),
  modelConfig: z
    .object({
      classifyModel: z.string().optional().describe("阶段分类模型"),
      extractModel: z.string().optional().describe("实体提取模型"),
    })
    .optional()
    .describe("模型配置"),
});

// ========== 输出结构 Schema ==========

const ClassifyIntentOutputSchema = z.object({
  planning: z.object({
    stage: FunnelStageSchema.describe("当前阶段"),
    needs: z.array(ReplyNeedSchema).max(8).describe("回复需求"),
    riskFlags: z.array(RiskFlagSchema).max(6).describe("风险标记"),
    confidence: z.number().min(0).max(1).describe("置信度"),
    reasoning: z.string().describe("分类理由"),
    stageGoal: StageGoalPolicySchema.describe("当前阶段的目标配置"),
  }),
  extraction: z.object({
    interview_info: InterviewInfoSchema.describe("面试信息"),
    preferences: PreferencesSchema.describe("意向信息"),
    reasoning: z.string().describe("提取理由/说明"),
  }),
});

// ========== 工具定义 ==========

/**
 * classify_intent 核心执行函数
 */
export async function executeClassifyIntent(params: ClassifyIntentInput): Promise<ClassifyIntentOutput> {
  const { message, conversationHistory, stageGoals, modelConfig } = params;

    // 1. 获取品牌数据（HTTP 请求）
    const brandData = await fetchBrandData();

    // 2. 任务 A & B：并行执行（性能最优）
    const [fullPlan, extractionResult] = await Promise.all([
      // 任务 A：阶段规划
      planTurn(message, {
        conversationHistory,
        modelConfig: {
          ...(modelConfig?.classifyModel && { classifyModel: modelConfig.classifyModel }),
        },
      }),

      // 任务 B：实体提取
      extractCandidateFacts(message, {
        conversationHistory,
        brandData,
        ...(modelConfig?.extractModel && {
          modelConfig: {
            extractModel: modelConfig.extractModel,
          },
        }),
      }),
    ]);

    // 3. 根据识别出的阶段，获取对应的目标配置
    const currentStageGoal = stageGoals[fullPlan.stage];

    if (!currentStageGoal) {
      throw createConfigError(
        ErrorCode.CONFIG_MISSING_FIELD,
        `Stage goal configuration missing for stage: ${fullPlan.stage}`,
        { configKey: `stageGoals.${fullPlan.stage}` }
      );
    }

    // 4. 合并结果
    return {
      planning: {
        stage: fullPlan.stage,
        needs: fullPlan.needs,
        riskFlags: fullPlan.riskFlags,
        confidence: fullPlan.confidence,
        reasoning: fullPlan.reasoningText,
        stageGoal: currentStageGoal,
      },
      extraction: {
        interview_info: extractionResult.interview_info,
        preferences: extractionResult.preferences,
        reasoning: extractionResult.reasoning,
      },
    };
}

/**
 * classify_intent 工具
 *
 * 执行流程：
 * 1. 获取品牌数据（fetchBrandData）
 * 2. 并行执行双任务（planTurn + extractCandidateFacts）
 * 3. 阶段映射（从 stageGoals 查找配置）
 * 4. 返回组合结果（planning + extraction）
 */
export const weworkClassifyIntentTool = tool({
  description: "企微智能化：阶段分类+回合规划+事实提取+风险标记",

  inputSchema: ClassifyIntentInputSchema,

  execute: executeClassifyIntent,
});

// ========== 类型导出 ==========

export type ClassifyIntentInput = z.infer<typeof ClassifyIntentInputSchema>;
export type ClassifyIntentOutput = z.infer<typeof ClassifyIntentOutputSchema>;
