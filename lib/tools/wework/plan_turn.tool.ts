import { tool } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod/v3";
import { planTurn } from "@/lib/agents/classification-agent";
import { ErrorCode, createConfigError } from "@/lib/errors";
import type { FunnelStage, StageGoals } from "@/types/reply-policy";
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
 * stageGoals 通过 toolContext.wework_plan_turn.stageGoals 注入，classifyModel 通过 context.modelConfig 注入。
 */
export function createWeworkPlanTurnTool(stageGoal: StageGoals, classifyModel?: string, processedMessages?: UIMessage[]) {
  return tool({
    description:
      "企微智能化：识别当前对话阶段、检测回复需求、标记风险因子，并返回当前阶段的运营目标配置",
    inputSchema: z.object({}),
    execute: async (): Promise<WeworkPlanTurnOutput> => {
      const allHistory = (processedMessages ?? [])
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => {
          const text = m.parts
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map(p => p.text)
            .join("");
          return `${m.role === "user" ? "用户" : "助手"}: ${text}`;
        })
        .filter(s => s.trim().length > 0);
      const message = allHistory.at(-1) ?? "";
      const conversationHistory = allHistory.slice(0, -1);
      const fullPlan = await planTurn(message, {
        conversationHistory,
        modelConfig: {
          ...(classifyModel && { classifyModel }),
        },
      });

      const effectiveStage = STAGE_FALLBACK[fullPlan.stage] ?? fullPlan.stage;
      const currentStageGoal = stageGoal[effectiveStage];

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
