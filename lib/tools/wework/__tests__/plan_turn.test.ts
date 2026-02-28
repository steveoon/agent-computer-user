/**
 * wework_plan_turn 工具单元测试
 *
 * 覆盖：
 * - 正常路径：返回 stage/needs/riskFlags/confidence/reasoning/stageGoal
 * - stageGoal 缺失：抛出 ConfigError
 * - classifyModel 通过工厂注入后正确透传给 planTurn
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StageGoalPolicy, ReplyPolicyConfig } from "@/types/reply-policy";
import type { WeworkPlanTurnOutput } from "../types";

// ========== Mock planTurn ==========

const mockPlanTurn = vi.fn();

vi.mock("@/lib/agents/classification-agent", () => ({
  planTurn: mockPlanTurn,
}));

vi.mock("@/lib/errors", async () => {
  const actual = await vi.importActual<typeof import("@/lib/errors")>("@/lib/errors");
  return actual;
});

// ========== 测试数据 ==========

const mockPlanResult = {
  stage: "job_consultation" as const,
  needs: ["salary", "location"] as const,
  riskFlags: [] as const,
  confidence: 0.9,
  reasoningText: "候选人询问薪资和地点",
  subGoals: [],
  extractedInfo: {
    mentionedBrand: null,
    city: null,
    mentionedLocations: [],
    mentionedDistricts: [],
    specificAge: null,
    hasUrgency: false,
    preferredSchedule: null,
  },
};

const mockStageGoal: StageGoalPolicy = {
  primaryGoal: "回答岗位问题并提升兴趣",
  successCriteria: ["候选人对岗位保持兴趣"],
  ctaStrategy: "先答核心问题，再给下一步建议",
  disallowedActions: ["编造数字或政策"],
};

const allStageGoals = {
  trust_building: mockStageGoal,
  private_channel: mockStageGoal,
  qualify_candidate: mockStageGoal,
  job_consultation: mockStageGoal,
  interview_scheduling: mockStageGoal,
  onboard_followup: mockStageGoal,
};

const mockReplyPolicy = { stageGoals: allStageGoals } as unknown as ReplyPolicyConfig;

// ========== 导入被测模块 ==========

const { createWeworkPlanTurnTool } = await import("../plan_turn.tool");

const weworkPlanTurnTool = createWeworkPlanTurnTool(mockReplyPolicy);

// AI SDK tool().execute 是可选属性，且返回联合类型；用辅助函数提升可读性
async function executeTool(
  tool: typeof weworkPlanTurnTool,
  input: Parameters<NonNullable<typeof weworkPlanTurnTool.execute>>[0]
): Promise<WeworkPlanTurnOutput> {
  if (!tool.execute) throw new Error("execute not defined");
  const result = await tool.execute(input, {} as never);
  return result as WeworkPlanTurnOutput;
}

// ========== 测试 ==========

describe("weworkPlanTurnTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlanTurn.mockResolvedValue(mockPlanResult);
  });

  it("应返回正确的输出结构", async () => {
    const result = await executeTool(weworkPlanTurnTool, {
      message: "你们薪资怎么样，在哪个区？",
      conversationHistory: ["候选人: 你好"],
    });

    expect(result.stage).toBe("job_consultation");
    expect(result.needs).toContain("salary");
    expect(result.riskFlags).toEqual([]);
    expect(result.confidence).toBe(0.9);
    expect(result.reasoning).toBe("候选人询问薪资和地点");
    expect(result.stageGoal).toEqual(mockStageGoal);
  });

  it("工厂注入 classifyModel 后应正确透传给 planTurn", async () => {
    const toolWithModel = createWeworkPlanTurnTool(mockReplyPolicy, "qwen-plus");
    const history = ["msg1", "msg2"];

    await executeTool(toolWithModel, { message: "消息", conversationHistory: history });

    expect(mockPlanTurn).toHaveBeenCalledWith(
      "消息",
      expect.objectContaining({
        conversationHistory: history,
        modelConfig: expect.objectContaining({ classifyModel: "qwen-plus" }),
      })
    );
  });

  it("不传 classifyModel 时 planTurn 应以空 modelConfig 调用", async () => {
    await executeTool(weworkPlanTurnTool, { message: "你好", conversationHistory: [] });

    expect(mockPlanTurn).toHaveBeenCalledWith(
      "你好",
      expect.objectContaining({ modelConfig: {} })
    );
  });

  it("stageGoals 中缺少当前 stage 时应抛出 ConfigError", async () => {
    const partialPolicy = {
      stageGoals: {
        trust_building: mockStageGoal,
        private_channel: mockStageGoal,
        qualify_candidate: mockStageGoal,
        interview_scheduling: mockStageGoal,
        onboard_followup: mockStageGoal,
      },
    } as unknown as ReplyPolicyConfig;

    const toolWithPartialGoals = createWeworkPlanTurnTool(partialPolicy);

    await expect(
      toolWithPartialGoals.execute?.({ message: "薪资怎么样", conversationHistory: [] }, {} as never)
    ).rejects.toThrow();
  });
});
