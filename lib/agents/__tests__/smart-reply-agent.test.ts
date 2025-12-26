/**
 * Smart Reply Agent 单元测试
 *
 * 测试智能回复 Agent 的核心功能
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockTextGeneration, createMockObjectGeneration } from "@/lib/__tests__/test-utils/ai-mocks";

// Mock classification result
const mockClassification = {
  replyType: "salary_inquiry",
  extractedInfo: {
    mentionedBrand: null,
    city: "成都",
    mentionedLocations: [],
    mentionedDistricts: [],
    specificAge: null,
    hasUrgency: false,
    preferredSchedule: null,
  },
  reasoningText: "候选人询问薪资待遇",
};

// Mock the dynamic registry
vi.mock("@/lib/model-registry/dynamic-registry", () => ({
  getDynamicRegistry: vi.fn(() => ({
    languageModel: vi.fn((modelId: string) => {
      // Return different mocks based on model type
      if (modelId.includes("classify")) {
        return createMockObjectGeneration(mockClassification);
      }
      return createMockTextGeneration("您好！我们的薪资待遇是综合薪资4000-6000元/月，包含底薪+提成+全勤奖励。");
    }),
  })),
}));

// Mock the classification function
vi.mock("../classification-agent", () => ({
  classifyMessage: vi.fn(async () => mockClassification),
}));

// Mock the reply prompt builder
vi.mock("@/lib/prompt-engineering", () => ({
  ReplyPromptBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn(() => ({
      system: "你是一个专业的招聘助手...",
      prompt: "请根据分类结果生成回复...",
    })),
    updateMemory: vi.fn(),
  })),
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
      expect(result.classification).toBeDefined();
      expect(result.classification.replyType).toBe("salary_inquiry");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("should include classification reasoning", async () => {
      const { generateSmartReply } = await import("../smart-reply-agent");

      const result = await generateSmartReply({
        candidateMessage: "请问还招人吗？",
        conversationHistory: [],
        configData: sampleConfigData,
      });

      expect(result.classification.reasoningText).toBeDefined();
      expect(result.classification.reasoningText.length).toBeGreaterThan(0);
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
        classifyMessage: vi.fn(async () => ({
          ...mockClassification,
          replyType: "interview_request",
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
});
