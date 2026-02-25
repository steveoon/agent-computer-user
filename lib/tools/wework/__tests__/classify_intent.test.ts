/**
 * classify_intent 工具集成测试
 *
 * 测试重点：
 * - 双任务并行执行（planTurn + extractCandidateFacts）
 * - 阶段映射（从 stageGoals 获取配置）
 * - 结果合并（planning + extraction）
 * - 配置注入（stageGoals 传入）
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeClassifyIntent } from "../classify_intent.tool";
import * as classificationAgent from "@/lib/agents/classification-agent";
import * as entityExtraction from "@/lib/agents/wework-entity-extraction-agent";
import type { StageGoalPolicy } from "@/types/reply-policy";

// Mock dependencies
vi.mock("@/lib/agents/classification-agent");
vi.mock("@/lib/agents/wework-entity-extraction-agent");

// Mock stage goals configuration
const MOCK_STAGE_GOALS: Record<string, StageGoalPolicy> = {
  trust_building: {
    primaryGoal: "建立信任并了解求职意向",
    successCriteria: ["候选人愿意继续沟通"],
    ctaStrategy: "用轻量提问引导需求细化",
    disallowedActions: ["过早承诺具体待遇"],
  },
  job_consultation: {
    primaryGoal: "回答岗位问题并提升兴趣",
    successCriteria: ["候选人对岗位保持兴趣"],
    ctaStrategy: "先答核心问题，再给下一步建议",
    disallowedActions: ["编造数字或政策"],
  },
  interview_scheduling: {
    primaryGoal: "推动面试预约",
    successCriteria: ["候选人给出可面试时间"],
    ctaStrategy: "给出明确时间选项并确认",
    disallowedActions: ["不确认候选人可到店性"],
  },
  qualify_candidate: {
    primaryGoal: "确认基本匹配度",
    successCriteria: ["完成年龄/时间/岗位匹配确认"],
    ctaStrategy: "逐条确认关键条件",
    disallowedActions: ["直接否定候选人"],
  },
  private_channel: {
    primaryGoal: "推动进入私域沟通",
    successCriteria: ["候选人愿意交换联系方式"],
    ctaStrategy: "说明后续沟通效率与资料同步价值",
    disallowedActions: ["强迫式要微信"],
  },
  onboard_followup: {
    primaryGoal: "促进到岗并保持回访",
    successCriteria: ["候选人确认上岗安排"],
    ctaStrategy: "明确下一步动作与提醒",
    disallowedActions: ["承诺不确定资源"],
  },
};

describe("weworkClassifyIntentTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fetchBrandData
    vi.spyOn(entityExtraction, "fetchBrandData").mockResolvedValue([
      { name: "肯德基", aliases: ["KFC", "开封菜"] },
      { name: "麦当劳", aliases: ["McDonald's", "金拱门"] },
    ]);
  });

  it("should return both planning and extraction results", async () => {
    // Mock planTurn result
    vi.spyOn(classificationAgent, "planTurn").mockResolvedValue({
      stage: "job_consultation",
      subGoals: ["提供门店信息", "说明薪资待遇"],
      needs: ["salary", "location"],
      riskFlags: [],
      confidence: 0.88,
      extractedInfo: {
        mentionedBrand: "肯德基",
        city: "上海",
        mentionedLocations: null,
        mentionedDistricts: null,
        specificAge: null,
        hasUrgency: null,
        preferredSchedule: null,
      },
      reasoningText: "候选人询问肯德基浦东门店和薪资，处于岗位咨询阶段",
    });

    // Mock extractCandidateFacts result
    vi.spyOn(entityExtraction, "extractCandidateFacts").mockResolvedValue({
      interview_info: {},
      preferences: {
        brands: ["肯德基"],
        cities: ["上海"],
        district: "浦东",
        salary: "想了解薪资",
      },
      reasoning: "候选人明确提及肯德基品牌和浦东位置偏好，询问薪资情况",
    });

    const result = await executeClassifyIntent({
      message: "你们肯德基浦东有门店吗，薪资怎么算",
        conversationHistory: [],
        stageGoals: MOCK_STAGE_GOALS,
    });

    // 验证 planning 结果
    expect(result.planning.stage).toBe("job_consultation");
    expect(result.planning.needs).toContain("salary");
    expect(result.planning.needs).toContain("location");
    expect(result.planning.confidence).toBe(0.88);
    expect(result.planning.stageGoal).toEqual(MOCK_STAGE_GOALS.job_consultation);

    // 验证 extraction 结果
    expect(result.extraction.preferences.brands).toContain("肯德基");
    expect(result.extraction.preferences.district).toBe("浦东");
  });

  it("should handle parallel execution of planTurn and extractCandidateFacts", async () => {
    vi.spyOn(classificationAgent, "planTurn").mockResolvedValue({
      stage: "interview_scheduling",
      subGoals: ["确认面试时间"],
      needs: ["interview", "availability"],
      riskFlags: [],
      confidence: 0.92,
      extractedInfo: {},
      reasoningText: "候选人提供了姓名、电话和面试时间，处于面试安排阶段",
    });

    vi.spyOn(entityExtraction, "extractCandidateFacts").mockResolvedValue({
      interview_info: {
        name: "张三",
        phone: "13800138000",
        interview_time: "明天下午2点",
      },
      preferences: {
        location: "浦东",
      },
      reasoning: "候选人提供了完整的面试预约信息（姓名、电话、时间）",
    });

    const result = await executeClassifyIntent({
      message: "我叫张三，手机13800138000，明天下午2点可以去面试",
      conversationHistory: ["候选人: 想去浦东那家店面试", "HR: 好的，请问您叫什么名字，方便留个联系方式吗？"],
      stageGoals: MOCK_STAGE_GOALS,
    });

    expect(result.planning.stage).toBe("interview_scheduling");
    expect(result.extraction.interview_info.name).toBe("张三");
    expect(result.extraction.interview_info.phone).toBe("13800138000");

    // 验证两个任务都被调用
    expect(classificationAgent.planTurn).toHaveBeenCalledOnce();
    expect(entityExtraction.extractCandidateFacts).toHaveBeenCalledOnce();
  });

  it("should map stage to correct stageGoal", async () => {
    vi.spyOn(classificationAgent, "planTurn").mockResolvedValue({
      stage: "qualify_candidate",
      subGoals: ["确认年龄", "确认时间可用性"],
      needs: ["requirements"],
      riskFlags: ["age_sensitive"],
      confidence: 0.75,
      extractedInfo: {},
      reasoningText: "候选人询问年龄要求，处于资质确认阶段",
    });

    vi.spyOn(entityExtraction, "extractCandidateFacts").mockResolvedValue({
      interview_info: {
        age: "17",
      },
      preferences: {},
      reasoning: "候选人透露了年龄信息",
    });

    const result = await executeClassifyIntent({
      message: "我17岁可以吗",
      conversationHistory: [],
      stageGoals: MOCK_STAGE_GOALS,
    });

    // 验证阶段映射
    expect(result.planning.stage).toBe("qualify_candidate");
    expect(result.planning.stageGoal).toEqual(MOCK_STAGE_GOALS.qualify_candidate);
    expect(result.planning.riskFlags).toContain("age_sensitive");
  });

  it("should throw when stageGoal not found in stageGoals", async () => {
    vi.spyOn(classificationAgent, "planTurn").mockResolvedValue({
      stage: "trust_building",
      subGoals: ["建立信任"],
      needs: ["none"],
      riskFlags: [],
      confidence: 0.8,
      extractedInfo: {},
      reasoningText: "初次接触",
    });

    vi.spyOn(entityExtraction, "extractCandidateFacts").mockResolvedValue({
      interview_info: {},
      preferences: {},
      reasoning: "无明确信息",
    });

    await expect(
      executeClassifyIntent({
        message: "你好",
        conversationHistory: [],
        stageGoals: {}, // 空的 stageGoals
      })
    ).rejects.toThrow("[classify_intent] Stage goal not found for stage: trust_building");
  });

  it("should throw when stageGoals is missing the current stage", async () => {
    vi.spyOn(classificationAgent, "planTurn").mockResolvedValue({
      stage: "job_consultation",
      subGoals: ["回答薪资问题"],
      needs: ["salary"],
      riskFlags: [],
      confidence: 0.7,
      extractedInfo: {},
      reasoningText: "候选人询问薪资",
    });

    vi.spyOn(entityExtraction, "extractCandidateFacts").mockResolvedValue({
      interview_info: {},
      preferences: {},
      reasoning: "无明确信息",
    });

    const stageGoals = {
      trust_building: MOCK_STAGE_GOALS.trust_building,
      private_channel: MOCK_STAGE_GOALS.private_channel,
    };

    await expect(
      executeClassifyIntent({
        message: "薪资怎么算",
        conversationHistory: [],
        stageGoals,
      })
    ).rejects.toThrow("[classify_intent] Stage goal not found for stage: job_consultation");
  });

  it("should pass brandData to extractCandidateFacts", async () => {
    const mockBrandData = [
      { name: "肯德基", aliases: ["KFC"] },
      { name: "麦当劳", aliases: ["McDonald's"] },
    ];

    vi.spyOn(entityExtraction, "fetchBrandData").mockResolvedValue(mockBrandData);

    vi.spyOn(classificationAgent, "planTurn").mockResolvedValue({
      stage: "job_consultation",
      subGoals: [],
      needs: ["stores"],
      riskFlags: [],
      confidence: 0.9,
      extractedInfo: {},
      reasoningText: "询问门店",
    });

    const extractSpy = vi.spyOn(entityExtraction, "extractCandidateFacts").mockResolvedValue({
      interview_info: {},
      preferences: {
        brands: ["肯德基"],
      },
      reasoning: "提及肯德基",
    });

    await executeClassifyIntent({
      message: "KFC有门店吗",
      conversationHistory: [],
      stageGoals: MOCK_STAGE_GOALS,
    });

    // 验证 brandData 被传递给 extractCandidateFacts
    expect(extractSpy).toHaveBeenCalledWith(
      "KFC有门店吗",
      expect.objectContaining({
        brandData: mockBrandData,
      })
    );
  });

  it("should pass modelConfig to both tasks", async () => {
    const modelConfig = {
      classifyModel: "qwen-plus",
      extractModel: "qwen-turbo",
    };

    vi.spyOn(classificationAgent, "planTurn").mockResolvedValue({
      stage: "trust_building",
      subGoals: [],
      needs: ["none"],
      riskFlags: [],
      confidence: 0.8,
      extractedInfo: {},
      reasoningText: "测试",
    });

    const extractSpy = vi.spyOn(entityExtraction, "extractCandidateFacts").mockResolvedValue({
      interview_info: {},
      preferences: {},
      reasoning: "测试",
    });

    await executeClassifyIntent({
      message: "测试",
      conversationHistory: [],
      stageGoals: MOCK_STAGE_GOALS,
      modelConfig,
    });

    // 验证 modelConfig 被传递
    expect(extractSpy).toHaveBeenCalledWith(
      "测试",
      expect.objectContaining({
        modelConfig: {
          extractModel: "qwen-turbo",
        },
      })
    );
  });
});
