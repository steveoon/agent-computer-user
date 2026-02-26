import { tool } from "ai";
import { z } from "zod/v3";
import { planTurn } from "@/lib/agents/classification-agent";
import { FunnelStageSchema, StageGoalPolicySchema } from "@/types/reply-policy";
import { ErrorCode, createConfigError } from "@/lib/errors";
import type { WeworkPlanTurnOutput } from "./types";

/**
 * 企微智能化：对话阶段规划工具
 *
 * 识别当前对话阶段（stage）、检测回复需求（needs）、标记风险因子（riskFlags），
 * 并从 stageGoals 配置中查找当前阶段的运营目标（stageGoal）。
 * 规则层 + LLM 层双重保障，阶段目标从运营后台动态注入。
 */
export const weworkPlanTurnTool = tool({
  description:
    "企微智能化：识别当前对话阶段、检测回复需求、标记风险因子，并返回当前阶段的运营目标配置",
  inputSchema: z.object({
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
      })
      .optional()
      .describe("模型配置"),
  }),
  execute: async ({ message, conversationHistory, stageGoals, modelConfig }): Promise<WeworkPlanTurnOutput> => {

    const fullPlan = await planTurn(message, {
      conversationHistory,
      modelConfig: {
        ...(modelConfig?.classifyModel && { classifyModel: modelConfig.classifyModel }),
      },
    });

    const currentStageGoal = stageGoals[fullPlan.stage];

    if (!currentStageGoal) {
      throw createConfigError(
        ErrorCode.CONFIG_MISSING_FIELD,
        `[wework_plan_turn] Stage goal not found for stage: ${fullPlan.stage}`,
        { configKey: `stageGoals.${fullPlan.stage}` }
      );
    }

    return {
      stage: fullPlan.stage,
      needs: fullPlan.needs,
      riskFlags: fullPlan.riskFlags,
      confidence: fullPlan.confidence,
      reasoning: fullPlan.reasoningText,
      stageGoal: currentStageGoal,
    };
  },
});
