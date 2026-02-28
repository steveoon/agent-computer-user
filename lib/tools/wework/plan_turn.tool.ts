import { tool } from "ai";
import { z } from "zod/v3";
import { planTurn } from "@/lib/agents/classification-agent";
import { ErrorCode, createConfigError } from "@/lib/errors";
import type { ReplyPolicyConfig } from "@/types/config";
import type { FunnelStage } from "@/types/reply-policy";
import type { WeworkPlanTurnOutput } from "./types";

/**
 * private_channel 阶段在企微场景中无实际运营目标配置，
 * 自动流转到 trust_building 阶段处理。
 */
const STAGE_FALLBACK: Partial<Record<FunnelStage, FunnelStage>> = {
  private_channel: "trust_building",
};

/**
 * 企微智能化：对话阶段规划工具
 *
 * 识别当前对话阶段（stage）、检测回复需求（needs）、标记风险因子（riskFlags），
 * 并从 stageGoals 配置中查找当前阶段的运营目标（stageGoal）。
 * 规则层 + LLM 层双重保障，阶段目标和模型配置均从运营后台动态注入。
 *
 * stageGoals 通过 context.replyPolicy 注入，classifyModel 通过 context.modelConfig 注入。
 */
export function createWeworkPlanTurnTool(replyPolicy: ReplyPolicyConfig, classifyModel?: string) {
  return tool({
    description:
      "企微智能化：识别当前对话阶段、检测回复需求、标记风险因子，并返回当前阶段的运营目标配置",
    inputSchema: z.object({
      message: z.string().describe("候选人当前消息"),
      conversationHistory: z
        .array(z.string())
        .default([])
        .describe("对话历史（最近 10 轮）"),
    }),
    execute: async ({ message, conversationHistory }): Promise<WeworkPlanTurnOutput> => {
      const fullPlan = await planTurn(message, {
        conversationHistory,
        modelConfig: {
          ...(classifyModel && { classifyModel }),
        },
      });

      const effectiveStage = STAGE_FALLBACK[fullPlan.stage] ?? fullPlan.stage;
      const currentStageGoal = replyPolicy.stageGoals[effectiveStage];

      if (!currentStageGoal) {
        throw createConfigError(
          ErrorCode.CONFIG_MISSING_FIELD,
          `[wework_plan_turn] Stage goal not found for stage: ${effectiveStage}`,
          { configKey: `stageGoals.${effectiveStage}` }
        );
      }

      return {
        stage: effectiveStage,
        needs: fullPlan.needs,
        riskFlags: fullPlan.riskFlags,
        confidence: fullPlan.confidence,
        reasoning: fullPlan.reasoningText,
        stageGoal: currentStageGoal,
      };
    },
  });
}
