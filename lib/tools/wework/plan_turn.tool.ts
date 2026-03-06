import { tool } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod/v3";
import { planTurn } from "@/lib/agents/classification-agent";
import { ErrorCode, createConfigError } from "@/lib/errors";
import type { StageGoals } from "@/types/reply-policy";
import type { WeworkPlanTurnOutput } from "./types";

/**
 * 企微场景已是私域通道，private_channel 阶段和 wechat need 无意义。
 * 通过 suppressedStages / suppressedNeeds 从分类代理的 prompt、规则、输出三层过滤。
 */
const WEWORK_SUPPRESSED_STAGES: string[] = ["private_channel"];
const WEWORK_SUPPRESSED_NEEDS: string[] = ["wechat"];

/**
 * 企微智能化：对话阶段规划工具
 *
 * 识别当前对话阶段（stage）、检测回复需求（needs）、标记风险因子（riskFlags），
 * 并从 stageGoals 配置中查找当前阶段的运营目标（stageGoal）。
 * 规则层 + LLM 层双重保障，阶段目标和模型配置均从运营后台动态注入。
 *
 * stageGoals 通过 toolContext.wework_plan_turn.stageGoals 注入，classifyModel 通过 context.modelConfig 注入。
 */
export function createWeworkPlanTurnTool(
  stageGoal: StageGoals,
  classifyModel?: string,
  processedMessages?: UIMessage[]
) {
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
        suppressedStages: WEWORK_SUPPRESSED_STAGES,
        suppressedNeeds: WEWORK_SUPPRESSED_NEEDS,
        stageGoals: stageGoal,
      });

      const currentStageGoal = stageGoal[fullPlan.stage];

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
}
