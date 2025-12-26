/**
 * Classification Agent 单元测试
 *
 * 测试消息分类 Agent 的核心功能
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockObjectGeneration } from "@/lib/__tests__/test-utils/ai-mocks";

// Mock the dynamic registry
vi.mock("@/lib/model-registry/dynamic-registry", () => ({
  getDynamicRegistry: vi.fn(() => ({
    languageModel: vi.fn(() => createMockObjectGeneration({
      replyType: "salary_inquiry",
      extractedInfo: {
        mentionedBrand: null,
        city: "成都",
        mentionedLocations: [
          { location: "春熙路", confidence: 0.9 },
        ],
        mentionedDistricts: [],
        specificAge: null,
        hasUrgency: false,
        preferredSchedule: null,
      },
      reasoningText: "候选人询问薪资待遇，属于 salary_inquiry 类型",
    })),
  })),
}));

// Mock the classification prompt builder
vi.mock("@/lib/prompt-engineering", () => ({
  ClassificationPromptBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn(() => ({
      system: "你是一个消息分类助手...",
      prompt: "请分类以下消息...",
    })),
  })),
}));

describe("classifyMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("classification", () => {
    it("should classify salary inquiry message correctly", async () => {
      const { classifyMessage } = await import("../classification-agent");

      const result = await classifyMessage("你们工资多少钱一个月？", {
        modelConfig: {},
        conversationHistory: [],
        brandData: {
          city: "成都",
          defaultBrand: "蜀地源冒菜",
          availableBrands: ["蜀地源冒菜", "蜀大侠"],
          storeCount: 10,
        },
      });

      expect(result).toBeDefined();
      expect(result.replyType).toBe("salary_inquiry");
      expect(result.extractedInfo).toBeDefined();
      expect(result.reasoningText).toContain("salary_inquiry");
    });

    it("should extract location information from message", async () => {
      const { classifyMessage } = await import("../classification-agent");

      const result = await classifyMessage("春熙路附近有门店吗？", {
        modelConfig: {},
        conversationHistory: [],
        brandData: {
          city: "成都",
          defaultBrand: "蜀地源冒菜",
          availableBrands: ["蜀地源冒菜"],
          storeCount: 10,
        },
      });

      expect(result.extractedInfo.mentionedLocations).toBeDefined();
      expect(result.extractedInfo.mentionedLocations?.length).toBeGreaterThan(0);
      expect(result.extractedInfo.mentionedLocations?.[0].location).toBe("春熙路");
    });

    it("should use custom provider configs when provided", async () => {
      const { classifyMessage } = await import("../classification-agent");

      const customProviderConfigs = {
        ohmygpt: {
          name: "ohmygpt",
          baseURL: "https://custom-api.example.com/v1",
          description: "Custom provider",
        },
      };

      const result = await classifyMessage("你好", {
        modelConfig: {},
        conversationHistory: [],
        brandData: {
          city: "成都",
          defaultBrand: "蜀地源冒菜",
          availableBrands: ["蜀地源冒菜"],
          storeCount: 5,
        },
        providerConfigs: customProviderConfigs,
      });

      expect(result).toBeDefined();
    });

    it("should include conversation history in classification", async () => {
      const { classifyMessage } = await import("../classification-agent");

      const result = await classifyMessage("那薪资呢？", {
        modelConfig: {},
        conversationHistory: [
          "候选人: 你好，请问还在招聘吗？",
          "HR: 是的，我们正在招聘服务员",
        ],
        brandData: {
          city: "成都",
          defaultBrand: "蜀地源冒菜",
          availableBrands: ["蜀地源冒菜"],
          storeCount: 10,
        },
      });

      expect(result).toBeDefined();
      expect(result.replyType).toBeDefined();
    });
  });
});
