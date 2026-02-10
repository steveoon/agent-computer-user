/**
 * Turn Planning Prompt Builder
 *
 * Policy-first: 输出 stage / subGoals / needs / riskFlags / extractedInfo / reasoningText。
 * 该构建器用于生成回合规划提示词，不负责回复生成。
 */

import { BasePromptBuilder } from "./base-prompt-builder";
import type {
  AtomicPrompt,
  BuilderConfig,
  Example,
  MolecularContext,
  PromptResult,
  StructuredContext,
} from "@/types/context-engineering";
import { FunnelStageSchema, ReplyNeedSchema, RiskFlagSchema } from "@/types/reply-policy";

export interface TurnPlanningParams {
  message: string;
  conversationHistory?: string[];
  brandData?: {
    city: string;
    defaultBrand: string;
    availableBrands: string[];
    storeCount?: number;
  };
}

export class TurnPlanningPromptBuilder extends BasePromptBuilder {
  constructor(config?: BuilderConfig) {
    super(config);
  }

  buildMolecularPrompt(_input: string, _context: Record<string, unknown>): MolecularContext {
    const structuredContext: StructuredContext = {
      conversationState: {
        replyType: "planning",
      },
      businessData: "",
      extractedFacts: {},
    };

    return {
      instruction: "规划本轮对话阶段与事实需求",
      examples: [],
      context: structuredContext,
      newInput: _input,
    };
  }

  getRelevantExamples(_input: string, _context: Record<string, unknown>, _max?: number): Example[] {
    return [];
  }

  buildAtomicSystemPrompt(): AtomicPrompt {
    return {
      task: "规划本轮招聘对话目标与事实需求",
      constraints: [
        "识别本轮对话的阶段(stage)与目标(subGoals)",
        "判断需要的事实(needs)，不臆断",
        "标注风险提示(riskFlags)",
        "保留 extractedInfo 供后续门店过滤",
      ],
      outputFormat: {
        language: "中文",
        length: { min: 50, max: 200 },
        format: "structured",
        restrictions: [
          "必须包含stage字段",
          "必须包含subGoals字段",
          "必须包含needs字段",
          "必须包含riskFlags字段",
          "必须包含extractedInfo字段",
          "必须包含reasoningText字段",
        ],
      },
    };
  }

  build(params: TurnPlanningParams): PromptResult {
    const atomic = this.buildAtomicSystemPrompt();
    const system = this.formatAtomicPrompt(atomic);

    const stageEnum = FunnelStageSchema.options.join(", ");
    const needEnum = ReplyNeedSchema.options.join(", ");
    const riskEnum = RiskFlagSchema.options.join(", ");

    const sections = [
      `[INSTRUCTION]`,
      "你是招聘对话回合规划器，不直接回复候选人。",
      "输出结构化结果用于后续回复生成。",
      "",
      `[STAGE ENUM]`,
      stageEnum,
      "",
      `[NEEDS ENUM]`,
      needEnum,
      "",
      `[RISK ENUM]`,
      riskEnum,
    ];

    if (params.conversationHistory && params.conversationHistory.length > 0) {
      sections.push("", "[CONVERSATION HISTORY]", params.conversationHistory.slice(-8).join("\n"));
    }

    if (params.brandData) {
      sections.push("", "[BRAND DATA]", JSON.stringify(params.brandData));
    }

    sections.push("", `[NEW INPUT]`, `"${params.message}"`);

    const prompt = sections.join("\n");

    return {
      system,
      prompt: this.optimizeForTokenBudget(prompt, this.config.tokenBudget || 2000),
      metadata: {
        estimatedTokens: this.estimateTokens(system + prompt),
      },
    };
  }
}

export const planningBuilder = new TurnPlanningPromptBuilder({
  maxExamples: 0,
  tokenBudget: 2000,
  enableMemory: false,
});
