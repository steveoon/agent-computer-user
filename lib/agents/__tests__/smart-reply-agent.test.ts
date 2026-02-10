/**
 * Smart Reply Agent 单元测试
 *
 * 测试智能回复 Agent 的核心功能
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTextGeneration, createMockObjectGeneration } from "@/lib/__tests__/test-utils/ai-mocks";

// Mock turn plan result
const mockTurnPlan = {
  stage: "job_consultation",
  subGoals: ["回答岗位问题", "推进下一步沟通"],
  needs: ["salary"],
  riskFlags: [],
  confidence: 0.8,
  extractedInfo: {
    mentionedBrand: null,
    city: "成都",
    mentionedLocations: [],
    mentionedDistricts: [],
    specificAge: null,
    hasUrgency: false,
    preferredSchedule: null,
  },
  reasoningText: "候选人询问薪资待遇，进入岗位咨询阶段",
};

// Mock the dynamic registry
vi.mock("@/lib/model-registry/dynamic-registry", () => ({
  getDynamicRegistry: vi.fn(() => ({
    languageModel: vi.fn((modelId: string) => {
      // Return different mocks based on model type
      if (modelId.includes("classify")) {
        return createMockObjectGeneration(mockTurnPlan);
      }
      return createMockTextGeneration("您好！我们的薪资待遇是综合薪资4000-6000元/月，包含底薪+提成+全勤奖励。");
    }),
  })),
}));

// Mock the planner function
vi.mock("../classification-agent", () => ({
  planTurn: vi.fn(async () => mockTurnPlan),
}));

// Sample config data for testing (using 'as unknown as' to avoid complex type matching)
// In real tests, you would use properly structured mock data
const sampleConfigData = {
  city: "成都",
  defaultBrand: "蜀地源冒菜",
  brands: {
    "蜀地源冒菜": {
      templates: {},
      screening: {
        ageRange: { min: 18, max: 45 },
      },
    },
  },
  stores: [
    {
      id: "store-1",
      name: "蜀地源冒菜（春熙路店）",
      brand: "蜀地源冒菜",
      location: "成都市锦江区春熙路123号",
      district: "锦江区",
      subarea: "春熙路",
      coordinates: { lat: 30.6571, lng: 104.0665 },
      transportation: "地铁春熙路站",
      positions: [],
    },
  ],
} as unknown as import("@/types/zhipin").ZhipinData;

describe("Smart Reply Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSmartReply", () => {
    it("should generate reply for salary inquiry", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "你们工资多少钱一个月？",
        conversationHistory: [],
        configData: sampleConfigData,
      });

      expect(result).toBeDefined();
      expect(result.suggestedReply).toContain("薪资");
      expect(result.turnPlan).toBeDefined();
      expect(result.turnPlan.stage).toBe("job_consultation");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should include classification reasoning", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "请问还招人吗？",
        conversationHistory: [],
        configData: sampleConfigData,
      });

      expect(result.turnPlan.reasoningText).toBeDefined();
      expect(result.turnPlan.reasoningText.length).toBeGreaterThan(0);
    });

    it("should use conversation history for context", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "那具体是多少？",
        conversationHistory: [
          "候选人: 你好，请问薪资待遇怎么样？",
          "HR: 我们的薪资待遇很有竞争力",
        ],
        configData: sampleConfigData,
      });

      expect(result).toBeDefined();
      expect(result.suggestedReply).toBeDefined();
    });

    it("should use preferred brand when provided", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "你们有多少家门店？",
        conversationHistory: [],
        preferredBrand: "蜀地源冒菜",
        configData: sampleConfigData,
      });

      expect(result).toBeDefined();
      expect(result.contextInfo).toContain("蜀地源冒菜");
    });

    it("should include candidate info in reply generation", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "有适合我的岗位吗？",
        conversationHistory: [],
        configData: sampleConfigData,
        candidateInfo: {
          name: "张三",
          age: "25",
          experience: "2年餐饮经验",
          education: "高中",
        },
      });

      expect(result).toBeDefined();
      expect(result.suggestedReply).toBeDefined();
    });

    it("should calculate confidence based on extracted info", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "成都春熙路附近有门店吗？",
        conversationHistory: [],
        configData: sampleConfigData,
      });

      // Confidence should be between 0 and 1
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should determine shouldExchangeWechat for interview requests", async () => {
      // Override mock for this specific test
      vi.doMock("../classification-agent", () => ({
        planTurn: vi.fn(async () => ({
          ...mockTurnPlan,
          stage: "interview_scheduling",
          needs: ["interview", "availability"],
        })),
      }));

      // Re-import to get the updated mock
      vi.resetModules();
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "我可以来面试吗？",
        conversationHistory: [],
        configData: sampleConfigData,
      });

      expect(result).toBeDefined();
      expect(result.shouldExchangeWechat).toBe(true);
    });

    it("should use custom model config when provided", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "你好",
        conversationHistory: [],
        configData: sampleConfigData,
        modelConfig: {
          classifyModel: "qwen/qwen-plus",
          replyModel: "qwen/qwen-turbo",
        },
      });

      expect(result).toBeDefined();
    });

    it("should include default wechat id when provided", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "可以加微信吗？",
        conversationHistory: [],
        configData: sampleConfigData,
        defaultWechatId: "hr_wechat_123",
      });

      expect(result).toBeDefined();
    });
  });

  describe("FactGate strict mode", () => {
    it("should trigger rewrite when reply has fact claims but context lacks facts", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");
      const { DEFAULT_REPLY_POLICY } = await import("@/types/reply-policy");

      // Mock reply contains "4000-6000元" (fact claim)
      // mockTurnPlan.needs = ["salary"] (requires facts)
      // sampleConfigData has empty positions (no salary facts in context)
      // → FactGate violation should trigger rewrite
      const result = await generateSmartReply({
        candidateMessage: "你们工资多少？",
        conversationHistory: [],
        configData: sampleConfigData,
        replyPolicy: DEFAULT_REPLY_POLICY,
      });

      expect(result).toBeDefined();
      expect(result.suggestedReply).toBeDefined();
      // latencyMs should be a valid number (not NaN), verifying the NaN fix
      if (result.latencyMs !== undefined) {
        expect(Number.isFinite(result.latencyMs)).toBe(true);
      }
    });

    it("should not trigger rewrite when no replyPolicy is provided", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "你们工资多少？",
        conversationHistory: [],
        configData: sampleConfigData,
        // No replyPolicy → FactGate skipped
      });

      expect(result).toBeDefined();
      expect(result.suggestedReply).toContain("薪资");
    });

    it("should not trigger rewrite when FactGate mode is not strict", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");
      const { DEFAULT_REPLY_POLICY } = await import("@/types/reply-policy");

      const nonStrictPolicy = {
        ...DEFAULT_REPLY_POLICY,
        factGate: { ...DEFAULT_REPLY_POLICY.factGate, mode: "balanced" as const },
      };

      const result = await generateSmartReply({
        candidateMessage: "你们工资多少？",
        conversationHistory: [],
        configData: sampleConfigData,
        replyPolicy: nonStrictPolicy,
      });

      expect(result).toBeDefined();
      // Original reply preserved (contains fact claims, but mode is not strict)
      expect(result.suggestedReply).toContain("薪资");
    });
  });
});
